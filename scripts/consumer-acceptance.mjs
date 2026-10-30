import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createNetServer } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'glide-consumer-')));
const npmCli = [process.env.npm_execpath,
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find(candidate => candidate && fs.existsSync(candidate));
assert.ok(npmCli, 'Run this test with npm run test:consumer so npm is available.');
const runNpm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], {
  cwd, encoding: 'utf8', timeout: 180000,
});
let cli, browser, vite, production;
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
async function waitForSource(project, predicate) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (predicate(fs.readFileSync(path.join(project, 'App.tsx'), 'utf8'))) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the browser mutation to persist.');
}
try {
  const packed = JSON.parse(runNpm(['pack', '--json', '--pack-destination', temp], root));
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ name: 'glide-isolated-consumer', private: true, type: 'module' }));
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', path.join(temp, packed[0].filename)], temp);
  const requireConsumer = createRequire(path.join(temp, 'package.json'));
  const entry = requireConsumer.resolve('@srivarsank/glide');
  assert.ok(entry.startsWith(temp), 'Consumer must resolve the installed tarball');
  assert.equal(fs.lstatSync(path.dirname(entry)).isSymbolicLink(), false);
  const cliPath = path.join(path.dirname(entry), 'cli.js');
  const empty = path.join(temp, 'empty');
  fs.mkdirSync(empty);
  fs.writeFileSync(path.join(empty, 'glide.config.js'), 'throw new Error("Help must not load config");');
  const before = fs.readdirSync(empty);
  for (const flag of ['--help', '-h', '--version', '-v']) {
    const output = execFileSync(process.execPath, [cliPath, flag], { cwd: empty, encoding: 'utf8', timeout: 10000 });
    if (flag.includes('help') || flag === '-h') assert.match(output, /Usage: glide/);
    else assert.equal(output.trim(), packageVersion);
    assert.deepEqual(fs.readdirSync(empty), before, 'Informational flags must not write files');
  }
  console.log('PASS: isolated install and side-effect-free CLI flags');
  const { VERSION } = await import(pathToFileURL(entry));
  assert.equal(VERSION, JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version);

  const project = path.join(temp, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'index.html'), '<html><head><style>@keyframes entrance { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } main { animation: entrance 20s ease; }</style></head><body><script type="module" src="/App.tsx"></script></body></html>');
  fs.writeFileSync(path.join(project, 'App.tsx'), `function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'style') Object.assign(el.style, value);
      else el.setAttribute(key === 'className' ? 'class' : key, value);
    }
    el.append(...children.filter(child => child !== false && child !== null)); return el;
  }
  document.body.append(<button style={{ width: '160px', height: '60px' }}>Consumer button</button>);
  document.body.append(<main style={{ position: 'relative', width: '600px', height: '300px', marginTop: '140px' }}></main>);
`);
  const { createServer, build, preview } = await import(pathToFileURL(requireConsumer.resolve('vite')));
  const { glideSourceStamping } = await import(pathToFileURL(requireConsumer.resolve('@srivarsank/glide/vite-plugin')));
  vite = await createServer({ root: project, configFile: false, esbuild: { jsxFactory: 'h' }, plugins: [glideSourceStamping()], server: { host: '127.0.0.1', port: 0, watch: { usePolling: true } } });
  await vite.listen();
  const targetPort = vite.httpServer.address().port;
  const reserve = createNetServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const editorPort = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  fs.writeFileSync(path.join(project, 'glide.config.json'), JSON.stringify({ port: editorPort, targetPort, defaultViewport: { width: 800, height: 600 } }));
  cli = spawn(process.execPath, [cliPath, '--no-skills'], { cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  cli.stdout.on('data', data => { logs += data; });
  cli.stderr.on('data', data => { logs += data; });
  // Wait for the installed CLI to report a listening server.
  const origin = await new Promise((resolve, reject) => {
    const deadline = Date.now() + 20000;
    const poll = setInterval(() => {
      const match = logs.match(/ws:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (match && Number(match[1]) > 0) { clearInterval(poll); resolve(`http://127.0.0.1:${match[1]}`); }
      else if (Date.now() > deadline || cli.exitCode !== null) { clearInterval(poll); reject(new Error(logs)); }
    }, 100);
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const outbound = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { outbound.push(url.href); return route.abort(); }
    return route.continue();
  });
  await page.goto(origin);
  await page.locator('#mode-btn-live').click();
  await page.waitForFunction(() => document.querySelectorAll('svg.lucide').length > 10);
  await page.evaluate(() => document.fonts.ready);
  const frame = page.frameLocator('#app-iframe');
  await frame.locator('main').waitFor();
  assert.equal(await frame.locator('main').evaluate(el => getComputedStyle(el).opacity), '1', 'Design mode must not freeze entrance animations at opacity zero');
  assert.equal(await frame.locator('main').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.locator('#btn-help-floating').click();
  await page.locator('#editor-shortcut-dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close shortcuts' }).click();
  for (const screenWidth of [1280, 1600]) {
    await page.setViewportSize({ width: screenWidth, height: 1000 });
    const headerSize = await page.locator('header').evaluate(el => ({width: el.clientWidth, scroll: el.scrollWidth, children: [...el.children].map(child => ({class: child.className, width: child.getBoundingClientRect().width, right: child.getBoundingClientRect().right}))}));
    assert.ok(headerSize.scroll <= headerSize.width + 1, `Editor header must fit at ${screenWidth}px: ${JSON.stringify(headerSize)}`);
    await page.locator('#zoom-label').click();
    await page.locator('[data-canvas-zoom="0.5"]').click();
    assert.equal(await page.locator('#zoom-label').textContent(), '50%');
    await page.locator('#zoom-label').click();
    await page.locator('[data-canvas-zoom="1"]').click();
  }
  await frame.getByRole('button', { name: 'Consumer button' }).click();
  // Selection reaches the editor by postMessage after the click resolves.
  const selectedSource = await (await page.waitForFunction(() => selectedElement?.source)).jsonValue();
  await page.locator('#zoom-label').click();
  await page.locator('[data-canvas-zoom="selection"]').click();
  assert.equal(await page.evaluate(() => selectedElement.source), selectedSource, 'Zoom menu must retain selection');
  const fitButton = await frame.getByRole('button', { name: 'Consumer button' }).boundingBox();
  const fitCanvas = await page.locator('#canvas-container').boundingBox();
  assert.ok(Math.abs(fitButton.x + fitButton.width / 2 - fitCanvas.x - fitCanvas.width / 2) < 2, 'Fit selection centers the selected element');
  await page.locator('#zoom-fit').click();
  if (process.env.GLIDE_ACCEPTANCE_SCREENSHOT) await page.screenshot({ path: process.env.GLIDE_ACCEPTANCE_SCREENSHOT });
  console.log('PASS: polished shell at 1280/1600, shortcut help, zoom presets, fit selection');
  await page.locator('#edit-representation').selectOption('inline');
  const width = page.locator('#prop-w');
  await width.fill('240');
  await width.press('Enter');
  await page.waitForFunction(() => document.querySelector('#prop-w')?.value === '240');
  await waitForSource(project, code => code.includes('240'));
  assert.deepEqual(outbound, [], 'Editor must not request remote assets');
  assert.deepEqual(errors, [], 'Served editor must run without browser errors');
  for (const asset of ['lucide.js', ...[300, 400, 500, 600, 700].map(w => `inter-${w}.woff2`)]) {
    const response = await fetch(`${origin}/__glide_assets__/${asset}`);
    assert.equal(response.status, 200, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  console.log('PASS: installed CLI, offline editor icons/fonts, browser edit persisted to source');

  // Real pointer gestures must persist without a CSS/JSON position sidecar.
  await page.reload();
  const button = frame.getByRole('button', { name: 'Consumer button' });
  await button.click();
  const bounds = await button.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 32, bounds.y + bounds.height / 2 + 24, { steps: 6 });
  await page.mouse.up();
  await waitForSource(project, code => /left:/.test(code) && /top:/.test(code));
  await page.reload();
  await button.click();
  const handle = page.locator('#selection-group rect[width="8"]').nth(2);
  await handle.waitFor({ state: 'visible' });
  const handleBounds = await handle.boundingBox();
  assert.ok(handleBounds, 'Resize handle must be visible');
  await page.mouse.move(handleBounds.x + 4, handleBounds.y + 4);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + 44, handleBounds.y + 24, { steps: 6 });
  await page.mouse.up();
  await waitForSource(project, code => !/width:\s*['"]240px['"]/.test(code));
  await page.reload();
  const measure = el => {
    const style = getComputedStyle(el);
    return Object.fromEntries(['width', 'height', 'left', 'top', 'position'].map(key => [key, style[key]]));
  };
  const edited = await button.evaluate(measure);
  assert.ok(parseFloat(edited.width) > 240 && parseFloat(edited.height) > 60, 'Resize must alter rendered size');
  assert.equal(edited.position, 'relative');
  assert.equal(fs.existsSync(path.join(project, 'glide-positions.json')), false);
  assert.equal(await frame.locator('#__glide_positions__').count(), 0);

  // Exercise the selector fallback panel with an uninstrumented runtime node.
  await button.evaluate(el => {
    const node = document.createElement('button');
    node.textContent = 'Unmapped runtime node';
    node.style.cssText = 'display:block;margin-top:120px';
    document.body.appendChild(node);
  });
  await frame.getByRole('button', { name: 'Unmapped runtime node' }).click();
  console.log('Fallback selection:', await page.evaluate(() => ({
    selected: typeof selectedElement === 'undefined' ? null : selectedElement,
    pending: typeof isPendingPositionUpdate === 'undefined' ? null : isPendingPositionUpdate,
    banner: document.getElementById('source-mapping-error')?.outerHTML,
  })));
  await page.locator('#source-mapping-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#props-content').evaluate(el => el.inert), true);
  await button.click();
  await page.locator('#source-mapping-error').waitFor({ state: 'hidden' });

  // Draw through the real canvas gesture and verify both source and runtime geometry.
  await page.reload();
  await frame.locator('main').waitFor();
  await page.waitForFunction(() => typeof currentFile === 'string' && fileDigests.size > 0);
  const iframeBounds = await page.locator('#app-iframe').boundingBox();
  const scale = iframeBounds.width / 800;
  const mainBounds = await frame.locator('main').boundingBox();
  await page.evaluate(() => setTool('rect'));
  await page.mouse.move(mainBounds.x + 40 * scale, mainBounds.y + 40 * scale);
  await page.mouse.down();
  await page.mouse.move(mainBounds.x + 160 * scale, mainBounds.y + 120 * scale, { steps: 8 });
  await page.mouse.up();
  await waitForSource(project, code => /backgroundColor:/.test(code));
  const shape = frame.locator('main > div');
  await shape.waitFor();
  const shapeStyle = await shape.evaluate(measure);
  assert.equal(shapeStyle.position, 'absolute');
  assert.ok(Math.abs(parseFloat(shapeStyle.left) - 40) <= 1);
  assert.ok(Math.abs(parseFloat(shapeStyle.top) - 40) <= 1);
  assert.ok(Math.abs(parseFloat(shapeStyle.width) - 120) <= 1);
  await shape.click();
  await page.locator('#btn-move-to-canvas').click();
  await waitForSource(project, code => /false &&/.test(code));
  await page.locator('[data-workspace-id]').waitFor();
  await shape.waitFor({ state: 'detached' });
  await page.reload();
  await page.locator('[data-workspace-id]').waitFor();
  assert.equal(await frame.locator('main > div').count(), 0);
  await page.locator('#workspace-layers').getByRole('button', { name: 'Restore', exact: true }).click();
  await waitForSource(project, code => !/data-gl-workspace-id/.test(code));
  await shape.waitFor();
  assert.deepEqual(await shape.evaluate(measure), shapeStyle);
  await page.locator('#btn-interaction-preview').click();
  await frame.locator('html:not([data-glide-design-mode])').waitFor();
  await page.locator('#btn-interaction-preview').click();
  await frame.locator('html[data-glide-design-mode]').waitFor();
  assert.equal(await page.locator('#app-iframe').evaluate(el => el.clientHeight), 600);
  console.log('PASS: drawn coordinates, source-backed detach/reload/restore, preview mode, fixed viewport');

  await page.evaluate(() => { zoomCanvasTo(0.5); setTool('text'); });
  const zoomedFrame = await page.locator('#app-iframe').boundingBox();
  await page.mouse.click(zoomedFrame.x - 70, zoomedFrame.y + 30);
  await waitForSource(project, code => /false &&/.test(code) && /New text/.test(code));
  const outside = page.locator('[data-workspace-id]');
  await outside.waitFor();
  assert.equal(await frame.getByText('New text', { exact: true }).count(), 0);
  const textInput = page.getByRole('textbox', { name: 'Canvas object text', exact: true });
  await textInput.fill('Canvas note');
  await textInput.press('Tab');
  await waitForSource(project, code => /Canvas note/.test(code));
  await outside.filter({ hasText: 'Canvas note' }).waitFor();
  const outsideBounds = await outside.boundingBox();
  const destinationBounds = await frame.locator('main').boundingBox();
  await page.mouse.move(outsideBounds.x + 5, outsideBounds.y + 5);
  await page.mouse.down();
  await page.mouse.move(destinationBounds.x + 180, destinationBounds.y + 90, { steps: 10 });
  await page.mouse.up();
  await waitForSource(project, code => !/data-gl-workspace-id/.test(code));
  const note = frame.getByText('Canvas note', { exact: true });
  await note.waitFor();
  await note.click();
  await page.waitForFunction(() => selectedElement && selectedElement.source && selectedSources.length === 1);
  await page.evaluate(() => triggerDelete());
  await waitForSource(project, code => !/Canvas note/.test(code));
  await note.waitFor({ state: 'detached' });
  let idleReloads = 0;
  const countReload = f => { if (f.parentFrame()) idleReloads++; };
  page.on('framenavigated', countReload);
  await page.waitForTimeout(750);
  page.off('framenavigated', countReload);
  assert.equal(idleReloads, 0, 'Idle editor must not continuously reload');
  console.log('PASS: outside text creation/edit, drag into frame, source deletion, and idle refresh stability');

  // A final runtime bound must not be dropped while persistence is pending.
  await shape.click();
  await page.evaluate(() => { isPendingPositionUpdate = true; });
  await shape.evaluate(el => { el.style.top = '75px'; });
  await page.waitForFunction(() => {
    const element = document.getElementById('app-iframe').contentDocument.querySelector('main > div');
    return selectedRect && Math.abs(selectedRect.y - element.getBoundingClientRect().top) < 1;
  });
  const outline = await page.locator('#selection-group rect').first().boundingBox();
  const actualShape = await shape.boundingBox();
  assert.ok(Math.abs(outline.y - actualShape.y) < 2, 'Selection outline must track the runtime element while a save is pending');
  await page.evaluate(() => { isPendingPositionUpdate = false; });
  await shape.evaluate((el, top) => { el.style.top = top; }, shapeStyle.top);

  const activeFile = await page.evaluate(() => currentFile);
  await shape.evaluate(el => {
    const source = el.getAttribute('data-gl-source');
    for (let i = 0; i < 20; i++) {
      window.parent.postMessage({ type: 'glide:element-hovered', source: 'Other.tsx:1:1' }, '*');
      window.parent.postMessage({ type: 'glide:element-selected', source }, '*');
    }
  });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => currentFile), activeFile, 'Hover must not switch the source tree');
  console.log('PASS: selection alignment during persistence and stable source tree during cross-file hover');

  fs.appendFileSync(path.join(project, 'App.tsx'), `\n['First instance', 'Second instance'].forEach(label => document.body.append(<p className="repeated">{label}</p>));\n`);
  const repeated = frame.locator('.repeated');
  await repeated.nth(1).waitFor();
  await repeated.nth(1).click();
  await page.waitForFunction(() => document.getElementById('source-mapping-error').textContent.includes('all 2 rendered instances'));
  await repeated.nth(1).evaluate(el => window.postMessage({ type: 'glide:select-element-by-id', id: el.getAttribute('data-gl-source') }, '*'));
  await page.waitForTimeout(100);
  assert.ok(await repeated.nth(1).evaluate(el => el.hasAttribute('data-glide-selected')), 'Source selection must retain the selected repeated DOM instance');
  console.log('PASS: shared-template warning and repeated instance selection');

  await build({ root: project, configFile: false, esbuild: { jsxFactory: 'h' }, plugins: [], logLevel: 'error' });
  production = await preview({ root: project, configFile: false, plugins: [], preview: { host: '127.0.0.1', port: 0 } });
  await page.goto(`http://127.0.0.1:${production.httpServer.address().port}`);
  const productionButton = page.getByRole('button', { name: 'Consumer button' });
  assert.deepEqual(await productionButton.evaluate(measure), edited, 'Layout must survive a production build without Glide');
  assert.equal(await productionButton.getAttribute('data-gl-source'), null);
  assert.deepEqual(outbound, []);
  assert.deepEqual(errors, []);
  console.log('PASS: pointer drag/resize, unmapped panel feedback, and production layout without Glide');
} finally {
  await browser?.close();
  if (cli && cli.exitCode === null) { cli.kill(); await new Promise(resolve => cli.once('exit', resolve)); }
  await vite?.close();
  if (production) await new Promise(resolve => production.httpServer.close(resolve));
  // Keep the isolated consumer for inspecting failures; it never uses workspace links.
  console.log(`Consumer fixture: ${temp}`);
}
