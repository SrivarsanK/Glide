import { describe, expect, test } from 'vitest';
import { transformJSXBatch, updateClassName, updateJSXText } from '../../packages/ast-writer/src/writer.js';

/** Apply one change to the element starting at `marker`. */
function edit(source: string, marker: string, change: Record<string, unknown>) {
  const index = source.indexOf(marker);
  const before = source.slice(0, index).split(/\r?\n/);
  return transformJSXBatch(source, [{ line: before.length, column: before[before.length - 1].length + 1, change } as any]);
}

const COMPONENT = `import { cn } from "@/lib/utils"

export function Card({ title }: { title: string }) {
  return (
    <section
      id="card"
      className="flex p-2"
      style={{ color: "red" }}
    >
      <h2 className="text-lg">
        Hello
      </h2>
      <p>{title}</p>
    </section>
  )
}
`;

const withSemicolons = COMPONENT.replace('"@/lib/utils"\n', '"@/lib/utils";\n').replace('  )\n}', '  );\n}');

describe.each([
  ['without semicolons, LF', COMPONENT],
  ['with semicolons, LF', withSemicolons],
  ['without semicolons, CRLF', COMPONENT.replace(/\n/g, '\r\n')],
  ['with semicolons, CRLF', withSemicolons.replace(/\n/g, '\r\n')],
])('a component in return (...) %s', (_, source) => {
  test.each([
    ['a class', '<section', { type: 'class', property: 'padding', value: '16px' }, 'className="flex p-2"', 'className="flex p-4"'],
    ['a new className', '<p>', { type: 'class', property: 'padding', value: '16px' }, '<p>', '<p className="p-4">'],
    ['a style value', '<section', { type: 'style', value: { color: 'blue' } }, '{{ color: "red" }}', '{{ color: "blue" }}'],
    ['a new style property', '<section', { type: 'style', value: { width: '30px' } }, '{{ color: "red" }}', '{{ color: "red", width: "30px" }}'],
    ['a new style attribute', '<h2', { type: 'style', value: { color: 'blue' } }, '<h2 className="text-lg">', '<h2 className="text-lg" style={{ color: "blue" }}>'],
    ['an inline class edit', '<h2', { type: 'class', property: 'width', value: '30px', authoringRepresentation: 'inline' }, '<h2 className="text-lg">', '<h2 className="text-lg" style={{ width: "30px" }}>'],
    ['text', '<h2', { type: 'text', value: 'Hi there' }, 'Hello', 'Hi there'],
    ['text with markup', '<h2', { type: 'text', value: 'a < b' }, 'Hello', '{"a < b"}'],
  ])('editing %s changes only that text', (_, marker, change, from, to) => {
    expect(edit(source, marker, change).code).toBe(source.replace(from, to));
  });

  test('several edits in one transaction each change only their own text', () => {
    const lines = source.split(/\r?\n/);
    const at = (marker: string) => {
      const line = lines.findIndex(text => text.includes(marker));
      return { line: line + 1, column: lines[line].indexOf(marker) + 1 };
    };
    const { code } = transformJSXBatch(source, [
      { ...at('<section'), change: { type: 'class', property: 'padding', value: '16px' } },
      { ...at('<h2'), change: { type: 'text', value: 'Hi there' } },
      { ...at('<p>'), change: { type: 'style', value: { color: 'blue' } } },
    ] as any);
    expect(code).toBe(source.replace('flex p-2', 'flex p-4').replace('Hello', 'Hi there').replace('<p>', '<p style={{ color: "blue" }}>'));
  });

  test('the legacy single-edit functions leave the return statement alone', () => {
    const line = source.split(/\r?\n/).findIndex(text => text.includes('<h2')) + 1;
    expect(updateClassName(source, line, 7, 'padding', '8px')).toBe(source.replace('"text-lg"', '"text-lg p-2"'));
    expect(updateJSXText(source, line, 7, 'Hi there')).toBe(source.replace('Hello', 'Hi there'));
  });
});

test('tab-indented text and multi-line template classes keep their tabs', () => {
  const source = 'export function A({ extra }: any) {\n\treturn (\n\t\t<div className={`p-2\n\t\t\tflex ${extra}`}>\n\t\t\tHello\n\t\t</div>\n\t)\n}\n';
  expect(edit(source, '<div', { type: 'text', value: 'Bye' }).code).toBe(source.replace('Hello', 'Bye'));
  expect(edit(source, '<div', { type: 'class', property: 'padding', value: '16px' }).code).toBe(source.replace('p-2', 'p-4'));
  expect(edit(source, '<div', { type: 'class', property: 'margin', value: '4px' }).code).toBe(source.replace('`p-2', '`m-1 p-2'));
});

test('new strings follow the quotes the file already uses', () => {
  const source = "export const A = () => {\n  return (\n    <div style={{ color: 'red' }}>\n      x\n    </div>\n  )\n}\n";
  expect(edit(source, '<div', { type: 'style', value: { width: '30px' } }).code)
    .toBe(source.replace("{{ color: 'red' }}", "{{ color: 'red', width: '30px' }}"));
  expect(edit(source, '<div', { type: 'class', property: 'padding', value: '16px' }).code)
    .toBe(source.replace("{{ color: 'red' }}>", "{{ color: 'red' }} className=\"p-4\">"));
});

test('cn arguments are added and removed without touching their neighbours', () => {
  const source = 'export function A({ className }: any) {\n  return (\n    <div\n      className={cn(\n        "flex",\n        "p-2",\n        className\n      )}\n    />\n  )\n}\n';
  expect(edit(source, '<div', { type: 'class', property: 'padding', value: '16px' }).code).toBe(source.replace('"p-2"', '"p-4"'));
  const passedIn = source.replace('        "flex",\n        "p-2",\n', '');
  expect(edit(passedIn, '<div', { type: 'class', property: 'padding', value: '16px' }).code)
    .toBe(passedIn.replace('cn(\n        className', 'cn(\n        "p-4",\n        className'));
  const duplicate = source.replace('"flex",', '"flex p-1",');
  expect(edit(duplicate, '<div', { type: 'class', property: 'padding', value: '16px' }).code)
    .toBe(source.replace('"flex",', '"flex p-4",').replace('        "p-2",\n', ''));
});

test('remaps follow elements moved by a new line', () => {
  const { code, remaps } = edit(COMPONENT, '<section', { type: 'style', value: { color: 'blue' } });
  expect(code).toBe(COMPONENT.replace('"red"', '"blue"'));
  const multiLine = COMPONENT.replace('      style={{ color: "red" }}\n', '');
  const result = edit(multiLine, '<section', { type: 'style', value: { color: 'blue' } });
  expect(result.code).toBe(COMPONENT.replace('"red"', '"blue"'));
  const h2 = result.remaps.find(remap => remap.oldLine === 9);
  expect(h2?.newCoordinates).toEqual({ line: 10, column: 7 });
  expect(remaps.find(remap => remap.oldLine === 10)?.newCoordinates).toEqual({ line: 10, column: 7 });
});
