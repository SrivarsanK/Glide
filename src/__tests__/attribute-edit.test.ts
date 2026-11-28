import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

function edit(source: string, marker: string, property: string, value: unknown) {
  const before = source.slice(0, source.indexOf(marker)).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1,
    change: { type: 'attribute', property, value } } as any]).code;
}
const app = (inner: string) => `const App = () => <main>${inner}<p id="taken">x</p></main>;`;

test('adds, changes and removes an attribute on an HTML element', () => {
  const added = edit(app('<a className="link">Go</a>'), '<a', 'href', '/pricing');
  expect(added).toContain('<a className="link" href="/pricing">Go</a>');
  const changed = edit(added, '<a', 'href', '#features');
  expect(changed).toContain('href="#features"');
  expect(edit(changed, '<a', 'href', null)).toContain('<a className="link">Go</a>');
  expect(edit(app('<button>Go</button>'), '<button', 'disabled', true)).toContain('<button disabled>Go</button>');
});

test('a new tab gets rel="noopener noreferrer", keeping rel tokens already written', () => {
  expect(edit(app('<a href="/x">Go</a>'), '<a', 'target', '_blank')).toContain('target="_blank" rel="noopener noreferrer"');
  expect(edit(app('<a href="/x" rel="author">Go</a>'), '<a', 'target', '_blank')).toContain('rel="author noopener noreferrer"');
});

test('refuses script links, bad or duplicate ids, components, spreads and computed values', () => {
  expect(() => edit(app('<a>Go</a>'), '<a', 'href', 'javascript:alert(1)')).toThrow(/INVALID_PROP/);
  expect(() => edit(app('<a>Go</a>'), '<a', 'href', ' java\nscript:alert(1)')).toThrow(/INVALID_PROP/);
  expect(() => edit(app('<img />'), '<img', 'src', 'data:text/html,x')).toThrow(/INVALID_PROP/);
  expect(() => edit(app('<div>A</div>'), '<div', 'id', 'taken')).toThrow(/already used/);
  expect(() => edit(app('<div>A</div>'), '<div', 'id', '1st')).toThrow(/INVALID_PROP/);
  expect(() => edit(app('<Card />'), '<Card', 'id', 'card')).toThrow(/UNSUPPORTED_OPERATION/);
  expect(() => edit(app('<a {...props}>Go</a>'), '<a', 'href', '/x')).toThrow(/spread/);
  expect(() => edit(app('<a href={url}>Go</a>'), '<a', 'href', '/x')).toThrow(/computed/);
  expect(() => edit(app('<a>Go</a>'), '<a', 'onClick', 'x')).toThrow(/UNSUPPORTED_OPERATION/);
});

test('allows ordinary links, mail and phone links, and aria attributes', () => {
  expect(edit(app('<a>Go</a>'), '<a', 'href', 'https://example.com')).toContain('href="https://example.com"');
  expect(edit(app('<a>Go</a>'), '<a', 'href', 'mailto:team@example.com')).toContain('mailto:');
  expect(edit(app('<div>A</div>'), '<div', 'aria-label', 'Hero')).toContain('aria-label="Hero"');
  expect(edit(app('<div>A</div>'), '<div', 'id', 'hero')).toContain('id="hero"');
});

test('refuses character references in links, because JSX decodes them into a script scheme', () => {
  expect(() => edit(app('<a>Go</a>'), '<a', 'href', 'javascript&#58;alert(1)')).toThrow(/Character references/);
  expect(() => edit(app('<a>Go</a>'), '<a', 'href', 'javascript&colon;alert(1)')).toThrow(/Character references/);
  expect(edit(app('<a>Go</a>'), '<a', 'href', '/search?a=1&b=2')).toContain('href="/search?a=1&b=2"');
});

test('a new tab refuses duplicate rel attributes', () => {
  expect(() => edit(app('<a href="/x" rel="a" rel={b}>Go</a>'), '<a', 'target', '_blank')).toThrow(/Duplicate rel/);
});

test('typed prop edits of HTML attributes keep working: false removes disabled, numbers become text', () => {
  const prop = (source: string, marker: string, property: string, value: unknown) => {
    const before = source.slice(0, source.indexOf(marker)).split('\n');
    return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1,
      change: { type: 'prop', property, value, scope: 'source-element' } } as any]).code;
  };
  expect(prop(app('<button disabled>Go</button>'), '<button', 'disabled', false)).toContain('<button>Go</button>');
  expect(prop(app('<div aria-expanded="true">A</div>'), '<div', 'aria-expanded', false)).toContain('aria-expanded="false"');
  expect(prop(app('<div aria-level="1">A</div>'), '<div', 'aria-level', 3)).toContain('aria-level="3"');
});

test('wraps quotes, newlines, and HTML entities in JSX expressions and ignores boolean rel', () => {
  const withQuotes = edit(app('<div>A</div>'), '<div', 'title', 'Say "hi"\n&lt;b&gt;');
  expect(withQuotes).toContain('title={"Say \\"hi\\"\\n&lt;b&gt;"}');
  const fromBoolRel = edit(app('<a href="/x" rel>Go</a>'), '<a', 'target', '_blank');
  expect(fromBoolRel).toContain('rel="noopener noreferrer"');
  expect(fromBoolRel).not.toContain('true');
});
