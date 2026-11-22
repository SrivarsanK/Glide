import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

const page = 'const App = () => (\n  <main id="top">\n    <header>Hi</header>\n  </main>\n);\n';
function insert(markup: string, extra: Record<string, unknown> = {}, source = page) {
  return transformJSXBatch(source, [{ line: 2, column: 3, change: { type: 'insert-markup', markup, ...extra } } as any]).code;
}

test('an agent adds static markup inside an element, on its own line', () => {
  const out = insert('<section className="p-8"><h2>Pricing</h2><a href="/buy">Buy</a></section>');
  expect(out).toMatch(/<header>Hi<\/header>\n    <section className="p-8">/);
  expect(out).toContain('<h2>Pricing</h2>');
  // Before a sibling, and a new tab gets rel.
  const first = insert('<a href="https://x.test" target="_blank">X</a>', { siblingId: 'line:3:col:4', position: 'before' });
  expect(first.indexOf('<a ')).toBeLessThan(first.indexOf('<header>'));
  expect(first).toContain('rel="noopener noreferrer"');
  expect(insert('<div style={{ padding: 8, color: "red" }} aria-label="Box" />')).toContain('aria-label="Box"');
});

test('refuses markup the canvas could not edit, or that is unsafe', () => {
  const refused = (markup: string, pattern: RegExp) => expect(() => insert(markup)).toThrow(pattern);
  refused('<Card />', /not an element Glide inserts/);
  refused('<p>{count}</p>', /static/);
  refused('<button onClick={() => go()}>Go</button>', /onClick is not an attribute/);
  refused('<a href="javascript:alert(1)">X</a>', /javascript: links/);
  refused('<div dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} />', /dangerouslySetInnerHTML is not an attribute/);
  refused('<div {...props} />', /spreads/);
  refused('<div style="color: red" />', /style is an object/);
  refused('<div id="top" />', /already used/);
  refused('<p>A</p><p>B</p>', /one JSX element/);
  refused('plain text', /one JSX element/);
  // Review fixes: repeated attributes, children on empty elements, ids written in braces, a sibling elsewhere.
  refused('<div className="a" className="b" />', /sets classname twice/);
  refused('<img src="https://x.test/a.png" alt="A">Caption</img>', /cannot have children/);
  expect(() => insert('<p id="hero" />', {}, page.replace('<main id="top">', '<main id={"hero"}>'))).toThrow(/already used/);
  const nested = 'const App = () => (\n  <main>\n    <header><b>Hi</b></header>\n  </main>\n);\n';
  expect(() => insert('<p>A</p>', { siblingId: 'line:3:col:12', position: 'before' }, nested)).toThrow(/direct child/);
});
