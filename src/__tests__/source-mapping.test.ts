import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { createSourceMapping } from '../../packages/overlay/src/source-mapping.js';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import { computeNodeHash, updateClassName, updateJSXStyleProp, updateJSXText } from '../../packages/ast-writer/src/writer.js';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

test.each(['class', 'style', 'text'])('single %s writes use raw source columns in tab-indented files', kind => {
  const source = 'const App = () => (\r\n\t<button>A</button>\r\n);';
  const hash = computeNodeHash('<button>A</button>');
  const result = kind === 'class' ? updateClassName(source, 2, 2, 'padding', 16, undefined, hash)
    : kind === 'style' ? updateJSXStyleProp(source, 2, 2, { color: 'red' }, hash)
    : updateJSXText(source, 2, 2, 'New', hash);
  expect(result).toContain(kind === 'class' ? 'p-4' : kind === 'style' ? 'red' : '>New</button>');
});

test('normalizes Windows paths and zero-based tree columns without confusing numeric hashes', () => {
  const mapping = createSourceMapping();
  expect(mapping.parse('C:\\app\\App.tsx:12:3:12345678')).toEqual({ file: 'C:/app/App.tsx', line: 12, column: 3, hash: '12345678' });
  expect(mapping.parse('line:2:col:0:abcdef01', 'App.tsx')).toEqual({ file: 'App.tsx', line: 2, column: 1, hash: 'abcdef01' });
  for (const source of ['__glide_cst_.card', '.card', 'App.tsx:0:1', 'App.tsx:1:0', 'line:2:col:0']) {
    expect(mapping.parse(source)).toBeNull();
  }
});

test('maps untouched siblings and ancestors through consecutive disk transactions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-mapping-'));
  roots.push(root);
  const file = path.join(root, 'App.tsx');
  const source = 'const App = () => (\r\n\t<div><button>A</button><button>A</button></div>\r\n);';
  fs.writeFileSync(file, source);
  const mapping = createSourceMapping();
  const service = new MutationService(root);
  const line = source.split('\r\n')[1];
  const column = line.lastIndexOf('<button') + 1;
  const oldHash = computeNodeHash('<button>A</button>');
  const selected = `App.tsx:2:${column}:${oldHash}`;
  const first = await service.execute('first', [{ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(source),
    line: 2, column: line.indexOf('<button') + 1, change: { type: 'style', value: { color: 'red' } } }]);
  expect(first.success, first.error).toBe(true);
  expect(first.selectionRemaps.filter(item => item.oldSourceId.startsWith('App.tsx:'))).toHaveLength(3);
  const next = mapping.parse(mapping.remap(selected, first.selectionRemaps))!;
  expect(next.column).not.toBe(column);
  expect(next.hash).toBe(oldHash);
  expect(mapping.remap(`App.tsx:2:${column}:deadbeef`, first.selectionRemaps)).toBe(`App.tsx:2:${column}:deadbeef`);
  const second = await service.execute('second', [{ operationId: 'two', filePath: next.file,
    expectedDigest: first.changedFiles[0].newDigest, line: next.line, column: next.column, hash: next.hash!,
    change: { type: 'text', value: 'Second' } }]);
  expect(second.success, second.error).toBe(true);
  const result = fs.readFileSync(file, 'utf8');
  expect(result).toContain('>A</button>');
  expect(result).toContain('>Second</button>');
  expect(result).toContain('\r\n');
  const rootRemap = first.selectionRemaps.find(item => item.oldSourceId === 'App.tsx:2:2')!;
  expect(rootRemap.newHash).not.toBe(rootRemap.oldHash);
});

test('the served editor executes the typed mapper and consumes successful transaction remaps', () => {
  const html = getEditorHTML();
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)![1];
  expect(() => new vm.Script(script)).not.toThrow();
  const initializer = script.slice(script.indexOf('const sourceMapping ='), script.indexOf('let currentFile ='));
  const handler = script.slice(script.indexOf('function applyTransactionMappings('), script.indexOf('function isSourceMatch('));
  const context = vm.createContext({});
  vm.runInContext(`${initializer}
    let currentFile = 'App.tsx';
    let selectedSources = ['App.tsx:1:1:aaaaaaaa'];
    let selectedElement = { source: selectedSources[0] };
    let glideClipboard = { source: selectedSources[0] };
    const fileDigests = new Map();
    const normalizePathSlash = value => value.split(String.fromCharCode(92)).join('/');
    const parseSource = value => sourceMapping.parse(value, currentFile);
    ${handler}
    const message = { success: true, changedFiles: [], selectionRemaps: [{ oldSourceId: 'App.tsx:1:1', oldHash: 'aaaaaaaa',
      newHash: 'bbbbbbbb', newDigest: 'digest-two', newCoordinates: { line: 3, column: 4 } }] };
    applyTransactionMappings({ ...message, success: false });
    if (selectedElement.source !== 'App.tsx:1:1:aaaaaaaa') throw new Error('Failed transaction changed selection');
    applyTransactionMappings(message);
    if (selectedElement.source !== 'App.tsx:3:4:bbbbbbbb' || selectedSources[0] !== selectedElement.source
      || glideClipboard.source !== selectedElement.source || fileDigests.get('App.tsx') !== 'digest-two') {
      throw new Error('Served transaction handler did not update selection and revision');
    }`, context);
});
