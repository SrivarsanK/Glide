// Real-browser check of the editor hosted by the Vite dev server: the editor and the app have
// different origins, edits still work, and app scripts cannot reach the editor. Run after npm run build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repo = fileURLToPath(new URL('../', import.meta.url));
const requireRepo = createRequire(path.join(repo, 'package.json'));
const { chromium } = requireRepo('playwright');
const { createServer } = await import(pathToFileURL(requireRepo.resolve('vite')));
const { glideSourceStamping } = await import(pathToFileURL(path.join(repo, 'dist/vite-plugin.js')));

const project = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'glide-hosted-check-')));
fs.writeFileSync(path.join(project, 'index.html'), '<html><head></head><body><script type="module" src="/App.tsx"></script></body></html>');
fs.writeFileSync(path.join(project, 'App.tsx'), `function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'style') Object.assign(el.style, value);
    else el.setAttribute(key === 'className' ? 'class' : key, value);
  }
  el.append(...children.filter(child => child !== false && child !== null)); return el;
}
document.body.append(<button style={{ width: '160px', height: '60px' }}>Hosted button</button>);
globalThis.h = h;
import('./Panel.tsx');
`);
// A second file that is never selected: drawing into it needs a digest the editor has not loaded.
fs.writeFileSync(path.join(project, 'Panel.tsx'), `document.body.append(<main style={{ position: 'relative', width: '600px', height: '300px', marginTop: '40px' }}><input /></main>);
`);
fs.writeFileSync(path.join(project, 'glide.config.json'), JSON.stringify({ defaultViewport: { width: 800, height: 600 } }));
const read = (file = 'App.tsx') => fs.readFileSync(path.join(project, file), 'utf8');
async function waitForSource(predicate, what, file) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (predicate(read(file))) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for: ' + what);
}

let vite, browser;
try {
  vite = await createServer({ root: project, configFile: false, logLevel: 'silent', esbuild: { jsxFactory: 'h' },
    plugins: [glideSourceStamping()], server: { host: '127.0.0.1', port: 0, watch: { usePolling: true } } });
  await vite.listen();
  const port = vite.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // Opened by name, the editor moves to the loopback IP; the preview stays on "localhost".
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.goto(`http://localhost:${port}/__glide/`);
    if (page.url().includes('/__glide/') && await page.locator('#app-iframe').count()) break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.equal(new URL(page.url()).origin, `http://127.0.0.1:${port}`);
  await page.locator('#mode-btn-live').click();
  const frame = page.frameLocator('#app-iframe');
  await frame.locator('main').waitFor();
  assert.equal(new URL(await page.locator('#app-iframe').getAttribute('src'), page.url()).origin, `http://localhost:${port}`);
  assert.equal(await page.evaluate(() => { try { return !!document.getElementById('app-iframe').contentDocument; } catch { return false; } }), false,
    'the editor must not be able to read the preview document either: the origins differ');
  console.log('PASS: editor on 127.0.0.1, preview on localhost');

  // Selection and an edit still work across the two origins.
  await frame.getByRole('button', { name: 'Hosted button' }).click();
  await page.waitForFunction(() => typeof selectedElement !== 'undefined' && selectedElement && selectedElement.source);
  assert.equal(await page.locator('#edit-representation').inputValue(), 'inline', 'a project without Tailwind writes inline styles by default');
  await page.waitForFunction(() => !/Reading/.test(document.getElementById('source-props').textContent));
  assert.doesNotMatch(await page.locator('#source-props').textContent(), /STALE_DIGEST/, 'props load on the first selection in a file');
  await page.locator('#prop-w').fill('240');
  await page.locator('#prop-w').press('Enter');
  await waitForSource(code => code.includes('240'), 'width edit');
  console.log('PASS: select and edit across origins');

  // The context menu opens at the pointer when the canvas is zoomed.
  await page.locator('#zoom-label').click();
  await page.locator('[data-canvas-zoom="0.5"]').click();
  // The width save reloads the page (no HMR here) whenever the polling watcher notices it, which on
  // Linux can be now; a right-click during the reload has no bridge to answer it, so click again.
  let target;
  for (let attempt = 1; ; attempt++) {
    target = await frame.getByRole('button', { name: 'Hosted button' }).boundingBox();
    await page.mouse.click(target.x + 10, target.y + 10, { button: 'right' });
    try { await page.locator('#glide-context-menu').waitFor({ state: 'visible', timeout: 3000 }); break; }
    catch (error) { if (attempt === 5) throw error; }
  }
  const menu = await page.locator('#glide-context-menu').boundingBox();
  assert.ok(Math.abs(menu.x - target.x - 10) < 3 && Math.abs(menu.y - target.y - 10) < 3, `menu at ${menu.x},${menu.y}, pointer at ${target.x + 10},${target.y + 10}`);
  await page.keyboard.press('Escape');
  await page.locator('#zoom-fit').click();

  // A PNG export draws the markup through an SVG image; the page has an <input>, which XML must close.
  const download = page.waitForEvent('download', { timeout: 10000 });
  await page.evaluate(() => triggerExport('PNG', '1x'));
  assert.match((await download).suggestedFilename(), /\.png$/);
  console.log('PASS: context menu at the pointer under zoom, PNG export');

  // Drawing asks the page for the container through the bridge.
  await frame.locator('main').waitFor();
  await page.evaluate(() => setTool('rect'));
  const box = await frame.locator('main').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 6 });
  await page.mouse.up();
  await waitForSource(code => (code.match(/<div/g) || []).length >= 1, 'drawn rectangle', 'Panel.tsx');
  console.log('PASS: draw a shape through the bridge query, into a file that was never selected');
  // The preview reloads for the changed file; the next step runs a script in it.
  await frame.locator('main div').waitFor();

  // A script in the app cannot reach the editor or its token.
  const appFrame = page.frames().find(item => item.url().startsWith(`http://localhost:${port}/`));
  const attack = await appFrame.evaluate(async port => {
    const result = {};
    try { result.parentDocument = !!window.parent.document; } catch { result.parentDocument = false; }
    const body = async url => { try { return await (await fetch(url)).text(); } catch { return null; } };
    result.ownOrigin = await body('/__glide/');
    result.editorOrigin = await body(`http://127.0.0.1:${port}/__glide/`);
    const socket = url => new Promise(resolve => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve('open'); ws.onerror = () => resolve('refused'); ws.onclose = () => resolve('refused');
    });
    result.socketEditorHost = await socket(`ws://127.0.0.1:${port}/__glide/ws`);
    result.socketAppHost = await socket(`ws://localhost:${port}/__glide/ws`);
    return result;
  }, port);
  assert.deepEqual(attack, { parentDocument: false, ownOrigin: null, editorOrigin: null, socketEditorHost: 'refused', socketAppHost: 'refused' });
  console.log('PASS: app scripts cannot read the editor page, fetch the token, or open the editor socket');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('PASS: no browser errors');
} finally {
  await browser?.close();
  await vite?.close();
  fs.rmSync(project, { recursive: true, force: true });
}
