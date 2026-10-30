import vm from 'node:vm';
import { parse } from '@babel/parser';
import { afterEach, expect, test } from 'vitest';
import * as os from 'node:os';
import { buildBridgeScript, glideSourceStamping } from '../../packages/vite-plugin/src/index.js';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import { createSourceMapping } from '../../packages/overlay/src/source-mapping.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/index.js';
import { closeTestProjects, request, startTestProject } from './server-fixture.js';

afterEach(closeTestProjects);

/** Function declarations from a served script, by name. */
function functions(script: string, names: string[]): string {
  const ast = parse(script);
  const found: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && names.includes(node.id?.name)) found.push(script.slice(node.start, node.end));
    for (const value of Object.values(node)) Array.isArray(value) ? value.forEach(walk) : walk(value);
  };
  walk(ast);
  expect(found).toHaveLength(names.length);
  return found.join('\n');
}

test('the bridge reports the components whose root is the selection, innermost first', () => {
  const script = buildBridgeScript(DEFAULT_CONFIG.sourceAttribute, DEFAULT_CONFIG.hoverAttribute,
    DEFAULT_CONFIG.selectedAttribute, DEFAULT_CONFIG.snapThresholdPx);
  const context = vm.createContext({});
  vm.runInContext(functions(script, ['glideComponentName', 'glideRootElement', 'glideOwners']), context);
  // <Page><div><IconButton id="c" /></div></Page>, where IconButton renders <Button size="lg"> and Button a <button>.
  const el: any = {};
  const host: any = { type: 'button', stateNode: el, memoizedProps: {} };
  const button: any = { type: function Button() {}, child: host,
    memoizedProps: { size: 'lg', id: 'c', onClick() {}, 'data-gl-source': 'src/Button.tsx:6:10' } };
  const memo: any = { type: { type: button.type }, child: button, memoizedProps: button.memoizedProps };
  const icon: any = { type: { render: function IconButton() {} }, child: memo,
    memoizedProps: { id: 'c', 'data-gl-source': 'src/main.tsx:8:7' } };
  const wrapper: any = { type: 'div', stateNode: {}, memoizedProps: {} };
  const page: any = { type: function Page() {}, child: wrapper, memoizedProps: { 'data-gl-source': 'src/main.tsx:12:1' } };
  host.return = memo; memo.return = button; button.return = icon; icon.return = wrapper; wrapper.return = page;
  el.__reactFiber$abc = host;
  // A memo wrapper repeats its child's props; the repeated usage is reported once.
  expect(JSON.parse(JSON.stringify(vm.runInContext('glideOwners', context)(el)))).toEqual([
    { name: 'Button', source: 'src/Button.tsx:6:10', props: { size: 'lg', id: 'c' } },
    { name: 'IconButton', source: 'src/main.tsx:8:7', props: { id: 'c' } },
  ]);
  expect(vm.runInContext('glideOwners', context)({})).toEqual([]);
});

test('the page gets the bridge script verbatim, even where it contains replacement patterns', () => {
  const plugin: any = glideSourceStamping();
  plugin.configResolved({ command: 'serve', root: os.tmpdir() });
  const page = '<html><head><title>App</title></head><body>x</body></html>';
  const html: string = plugin.transformIndexHtml(page);
  const script = html.match(/<head><script>([\s\S]*?)<\/script>/)![1];
  expect(script).toContain("'__reactFiber$'");
  expect(() => new vm.Script(script)).not.toThrow();
  expect(html.endsWith('<title>App</title></head><body>x</body></html>')).toBe(true);
  expect(html.split('<title>').length).toBe(2);
});

function editor(owners: any[]) {
  const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)![1];
  const context = vm.createContext({ createSourceMapping, owners });
  vm.runInContext(`
    const sourceMapping = createSourceMapping(), sourceFileAliases = new Map(), fileDigests = new Map();
    let currentFile = 'src/main.tsx', editScope = null, editScopeRequest = 0;
    let selectedElement = { source: 'src/Button.tsx:3:10', owners };
    const sent = [], toasts = [], WebSocket = { OPEN: 1 };
    const socket = { readyState: 1, send(value) { sent.push(JSON.parse(value)); } };
    const elements = { 'edit-scope-row': { style: {} }, 'edit-scope': { value: '', options: [],
      replaceChildren(...options) { this.options = options; } } };
    const document = { getElementById: id => elements[id], createElement: () => ({}) };
    function showToast(kind, message) { toasts.push(message); }
    ${functions(script, ['normalizePathSlash', 'sameSourceFile', 'parseSource', 'requestEditScopes', 'acceptEditScopes', 'scopedEdit'])}
  `, context);
  return context;
}

const OWNERS = [
  { name: 'Button', source: 'src/Button.tsx:6:10', props: { size: 'lg' } },
  { name: 'IconButton', source: 'src/main.tsx:8:7', props: {} },
];

test('the editor asks for scopes and defaults to the outermost usage that reaches the element', () => {
  const context = editor(OWNERS);
  vm.runInContext('requestEditScopes()', context);
  expect(vm.runInContext('sent', context)).toEqual([{ type: 'inspect-scopes', requestId: 1, levels: [
    { file: 'src/Button.tsx', line: 3, column: 10 },
    { file: 'src/Button.tsx', line: 6, column: 10, name: 'Button', props: { size: 'lg' } },
    { file: 'src/main.tsx', line: 8, column: 7, name: 'IconButton', props: {} },
  ] }]);
  vm.runInContext(`acceptEditScopes({ type: 'edit-scopes', requestId: 1, success: true, forwards: [true, true],
    variants: [{ group: 'size', option: 'lg', definition: 'buttonVariants', shared: true }],
    files: [{ file: 'src/main.tsx', digest: 'd1' }] })`, context);
  const options = vm.runInContext('elements["edit-scope"].options', context).map((option: any) => option.textContent);
  expect(options).toEqual([
    'Every <Button> · Button.tsx:3',
    'Every <IconButton> · Button.tsx:6',
    'This <IconButton> · main.tsx:8',
    'Every <Button size="lg"> · all buttonVariants users',
  ]);
  expect(vm.runInContext('elements["edit-scope"].value', context)).toBe('2');
  expect(vm.runInContext('fileDigests.get("src/main.tsx")', context)).toBe('d1');
  // Class edits follow the scope; text edits and inline styles do not.
  expect(vm.runInContext(`scopedEdit('src/Button.tsx:3:10', { type: 'class', property: 'padding', value: 16 })`, context))
    .toEqual({ source: 'src/main.tsx:8:7', change: { type: 'class', property: 'padding', value: 16 } });
  expect(vm.runInContext(`scopedEdit('src/Button.tsx:3:10', { type: 'style', value: { color: 'red' } })`, context).change)
    .toEqual({ type: 'style', value: { color: 'red' }, authoringRepresentation: 'tailwind' });
  expect(vm.runInContext(`scopedEdit('src/Button.tsx:3:10', { type: 'text', value: 'Go' })`, context).source).toBe('src/Button.tsx:3:10');
  expect(vm.runInContext(`scopedEdit('src/Button.tsx:3:10', { type: 'class', property: 'width', value: 4, authoringRepresentation: 'inline' })`, context)).toBeNull();
  expect(vm.runInContext('toasts[0]', context)).toContain('Inline styles cannot target this scope');
  vm.runInContext('elements["edit-scope"].value = "3"; elements["edit-scope"].onchange()', context);
  expect(vm.runInContext(`scopedEdit('src/Button.tsx:3:10', { type: 'class', property: 'padding', value: 16 })`, context))
    .toEqual({ source: 'src/Button.tsx:3:10', change: { type: 'class', property: 'padding', value: 16, variant: { group: 'size', option: 'lg' } } });
});

test('a usage the className does not reach is shown but cannot be chosen', () => {
  const context = editor(OWNERS);
  vm.runInContext('requestEditScopes()', context);
  vm.runInContext(`acceptEditScopes({ type: 'edit-scopes', requestId: 1, success: true, forwards: [true, false], variants: [], files: [] })`, context);
  const options = vm.runInContext('elements["edit-scope"].options', context);
  expect(options[2]).toMatchObject({ disabled: true, textContent: 'This <IconButton> · main.tsx:8 (not passed down)',
    title: '<IconButton> does not pass className to the element inside it' });
  expect(vm.runInContext('elements["edit-scope"].value', context)).toBe('1');
  // A stale reply for an earlier selection is ignored.
  vm.runInContext(`acceptEditScopes({ type: 'edit-scopes', requestId: 0, success: true, forwards: [], variants: [], files: [] })`, context);
  expect(vm.runInContext('elements["edit-scope"].value', context)).toBe('1');
});

test('the server reports className forwarding, active variants and digests across files', async () => {
  const button = `import { cva } from "class-variance-authority"
const buttonVariants = cva("rounded", { variants: { size: { sm: "h-8", lg: "h-10" } }, defaultVariants: { size: "sm" } })
export function Button({ className, size, ...props }: any) {
  return <button className={buttonVariants({ size, className })} {...props} />
}
export function Hero() {
  return <section className="p-8" />
}
`;
  const project = await startTestProject('import { Button, Hero } from "./Button";\nexport const App = () => <main><Button size="lg" /><Hero /></main>;\n');
  project.write('Button.tsx', button);
  const client = await project.connect();
  const level = (file: string, marker: string, extra = {}) => {
    const code = project.read(file);
    const before = code.slice(0, code.indexOf(marker)).split('\n');
    return { file, line: before.length, column: before[before.length - 1].length + 1, ...extra };
  };
  const reply = await request(client, { type: 'inspect-scopes', requestId: 7, levels: [
    level('Button.tsx', '<button'), level('App.tsx', '<Button', { name: 'Button', props: { size: 'lg' } })] }, 'edit-scopes');
  expect(reply).toMatchObject({ requestId: 7, success: true, forwards: [true],
    variants: [{ group: 'size', option: 'lg', definition: 'buttonVariants', shared: false }] });
  expect(reply.files.map((file: any) => file.file)).toEqual(['Button.tsx', 'App.tsx']);
  const hero = await request(client, { type: 'inspect-scopes', requestId: 8, levels: [
    level('Button.tsx', '<section'), level('App.tsx', '<Hero', { name: 'Hero', props: {} })] }, 'edit-scopes');
  expect(hero).toMatchObject({ success: true, forwards: [false], variants: [] });
  const outside = await request(client, { type: 'inspect-scopes', requestId: 9, levels: [
    { file: '../outside.tsx', line: 1, column: 1 }, level('App.tsx', '<Hero', { name: 'Hero' })] }, 'edit-scopes');
  expect(outside.success).toBe(false);
});
