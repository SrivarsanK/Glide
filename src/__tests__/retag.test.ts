import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

function retag(source: string, marker: string, tagName: string) {
  const before = source.slice(0, source.indexOf(marker)).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1, change: { type: 'retag', tagName } } as any]).code;
}
const app = (inner: string) => `const App = () => <main>${inner}</main>;`;

test('changes the opening and closing tag and keeps attributes and children', () => {
  expect(retag(app('<div className="hero">Hi <b>there</b></div>'), '<div', 'section')).toContain('<section className="hero">Hi <b>there</b></section>');
  expect(retag(app('<span>Title</span>'), '<span', 'h2')).toContain('<h2>Title</h2>');
  expect(retag(app('<div />'), '<div', 'nav')).toContain('<nav />');
});

test('a new button gets type="button" and keeps an existing one', () => {
  expect(retag(app('<div>Go</div>'), '<div', 'button')).toContain('<button type="button">Go</button>');
  expect(retag(app('<div type="button">Go</div>'), '<div', 'button')).toContain('<button type="button">Go</button>');
  expect(() => retag(app('<div type="submit">Go</div>'), '<div', 'button')).toThrow(/Remove type first/);
});

test('refuses changes that would make invalid HTML or drop attributes', () => {
  expect(() => retag(app('<a href="/x"><span>Go</span></a>'), '<span', 'a')).toThrow(/inside a link or button/);
  expect(() => retag(app('<div><button>Go</button></div>'), '<div', 'a')).toThrow(/cannot contain links, buttons/);
  expect(() => retag(app('<div><span tabIndex={0}>Go</span></div>'), '<div', 'button')).toThrow(/cannot contain/);
  expect(() => retag(app('<a href="/x">Go</a>'), '<a', 'div')).toThrow(/Remove href first/);
  expect(() => retag(app('<div>Item</div>'), '<div', 'li')).toThrow(/directly in a <ul> or <ol>/);
  expect(() => retag(app('<ul><li>A</li></ul>'), '<ul', 'div')).toThrow(/list items need a list/);
  expect(() => retag(app('<div><section>A</section></div>'), '<div', 'p')).toThrow(/cannot contain block/);
  expect(() => retag(app('<p><span>A</span></p>'), '<span', 'div')).toThrow(/inside a paragraph/);
  expect(() => retag(app('<Card />'), '<Card', 'section')).toThrow(/component/);
  expect(() => retag(app('<div>A</div>'), '<div', 'script')).toThrow(/not a tag/);
});

test('list items can move between list kinds', () => {
  expect(retag(app('<ul><li>A</li></ul>'), '<ul', 'ol')).toContain('<ol><li>A</li></ol>');
  expect(retag(app('<ul><div>A</div></ul>'), '<div>A', 'li')).toContain('<ul><li>A</li></ul>');
});
