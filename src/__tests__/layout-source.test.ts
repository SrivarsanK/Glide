import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import { closeTestProjects, startTestProject, request } from './server-fixture.js';

afterEach(closeTestProjects);

test.each(['flex', 'grid', 'block'])('drag and resize preserve %s and persist in one undoable source transaction', async display => {
  const original = `const App = () => <main style={{ display: '${display}' }}><button style={{ color: 'red' }}>A</button><button>B</button></main>;`;
  const f = await startTestProject(original), client = await f.connect();
  const result = await request(client, f.edit({ type: 'layout', layoutPosition: 'static', value: { left: '24px', top: '12px', width: '160px', height: '60px' } }));
  expect(result.success, result.error).toBe(true);
  expect(f.read()).toContain(`display: '${display}'`);
  expect(f.read()).toContain('position: "relative"');
  expect(f.read()).toContain('width: "160px"');
  expect(f.read()).toContain("color: 'red'");
  expect(f.read()).toContain('<button>B</button>');
  expect(fs.readdirSync(f.root).some(name => /position.*\.(css|json)/.test(name))).toBe(false);
  const history = await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE');
  expect(history.stack).toHaveLength(1);
  expect((await request(client, { type: 'undo', transactionId: 'undo-layout' })).success).toBe(true);
  expect(f.read()).toBe(original);
});

test('absolute elements retain positioning; resize alone does not add positioning', async () => {
  const f = await startTestProject(), client = await f.connect();
  expect((await request(client, f.edit({ type: 'layout', layoutPosition: 'absolute', value: { left: '24px' } }))).success).toBe(true);
  expect(f.read()).toContain('position: "absolute"');
  const g = await startTestProject(), other = await g.connect();
  expect((await request(other, g.edit({ type: 'layout', value: { width: '90px' } }))).success).toBe(true);
  expect(g.read()).not.toContain('position:');
});

test.each([
  { layoutPosition: 'sticky', value: { left: '3px' } },
  { value: { width: '-3px' } },
  { value: { display: 'absolute' } },
])('unsupported gestures do not modify source or history', async change => {
  const f = await startTestProject(), client = await f.connect(), original = f.read();
  expect((await request(client, f.edit({ type: 'layout', ...change }))).success).toBe(false);
  expect(f.read()).toBe(original);
  expect((await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).stack).toHaveLength(0);
});
