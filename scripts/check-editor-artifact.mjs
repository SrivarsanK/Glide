import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getEditorHTML } from '../dist/index.js';

// Run after npm run build. This verifies the bundled served code, not a fresh install.
const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'The distribution must contain the served editor script');
new vm.Script(script);
const mapper = script.slice(script.indexOf('const sourceMapping ='), script.indexOf('let currentFile ='));
const start = script.indexOf('if (!sourceTransport) sourceTransport =');
assert.ok(start >= 0, 'The distribution must use the shared mutation transport');
const transport = script.slice(start, script.indexOf('socket.send =', start));
vm.runInNewContext(`
  ${mapper}
  let sourceTransport = null;
  const sent = [];
  const socket = { sendRaw: value => sent.push(JSON.parse(value)) };
  const fileDigests = new Map([['App.tsx', 'before']]);
  const normalizePathSlash = value => value;
  const currentFile = 'App.tsx';
  let sequence = 0;
  const crypto = { randomUUID: () => String(++sequence) };
  const showToast = (kind, error) => { throw new Error(error); };
  let pendingBatch = null;
  const updateStagingBarUI = () => {};
  ${transport}
  sourceTransport.connected();
  const edit = { type: 'edit', file: 'App.tsx', line: 1, column: 5, change: { type: 'text', value: 'New' } };
  sourceTransport.send(JSON.stringify(edit));
  sourceTransport.send(JSON.stringify(edit));
  assert.equal(sent.length, 1);
  sourceTransport.disconnected();
  sourceTransport.connected();
  assert.equal(JSON.stringify(sent[0]), JSON.stringify(sent[1]));
  sourceTransport.accept({ type: 'status', transactionId: 'edit:1', success: true, selectionRemaps: [
    { oldSourceId: 'App.tsx:1:5', oldHash: 'aaaaaaaa', newHash: 'bbbbbbbb', newDigest: 'after', newCoordinates: { line: 2, column: 7 } },
  ] });
  assert.equal(sent.length, 3);
  assert.equal(sent[2].edits[0].line, 2);
  assert.equal(sent[2].edits[0].column, 7);
  assert.equal(sent[2].edits[0].expectedDigest, 'after');
`, { assert });
console.log('PASS: bundled editor parses; served transport serializes, retries, and remaps queued edits.');
