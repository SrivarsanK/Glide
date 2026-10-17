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
  fs.writeFileSync(path.join(project, 'index.html'), '<html><head></head><body><script type="module" src="/App.tsx"></script></body></html>');
  fs.writeFileSync(path.join(project, 'App.tsx'), `function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'style') Object.assign(el.style, value);
      else el.setAttribute(key === 'className' ? 'class' : key, value);
    }
    el.append(...children); return el;
  }
  document.body.append(<button style={{ width: '160px', height: '60px' }}>Consumer button</button>);
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
  await frame.getByRole('button', { name: 'Consumer button' }).click();
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
    el.parentElement.appendChild(node);
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
