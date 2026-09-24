import { describe, test, expect } from 'vitest';
import { parseJSXElements } from '../../packages/ast-writer/src/reorder.js';

const FILE = '/src/App.tsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parse(source: string) {
  return parseJSXElements(source, FILE);
}

// ── Basic cases ───────────────────────────────────────────────────────────────

describe('parseJSXElements', () => {

  test('returns empty array for non-JSX TypeScript', () => {
    const source = `const x: number = 1;\nexport default x;`;
    expect(parse(source)).toEqual([]);
  });

  test('returns empty array for invalid/empty source', () => {
    expect(parse('')).toEqual([]);
    expect(parse('!@#$%')).toEqual([]);
  });

  test('single root element returns one record', () => {
    const source = `
export default function App() {
  return <div>hello</div>;
}`;
    const records = parse(source);
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('div');
    // line 3, col 10 (1-indexed)
    expect(records[0].line).toBe(3);
    expect(records[0].col).toBeGreaterThanOrEqual(1);
    expect(records[0].id).toBe(`${FILE}:${records[0].line}:${records[0].col}`);
  });

  test('id format matches babel-plugin stamp (path:line:col)', () => {
    const source = `export default () => <span />;`;
    const records = parse(source);
    expect(records).toHaveLength(1);
    expect(records[0].id).toMatch(new RegExp(`^${FILE.replace('/', '/')}:\\d+:\\d+$`));
  });

  test('nested elements all returned in document order', () => {
    const source = `
export default function App() {
  return (
    <div>
      <header>
        <h1>Title</h1>
      </header>
      <main />
    </div>
  );
}`;
    const records = parse(source);
    // div, header, h1, main
    expect(records).toHaveLength(4);
    const tags = records.map(r => r.tag);
    expect(tags).toEqual(['div', 'header', 'h1', 'main']);
  });

  test('sibling elements both returned', () => {
    const source = `
export default function App() {
  return (
    <>
      <p>first</p>
      <p>second</p>
    </>
  );
}`;
    const records = parse(source);
    const tags = records.map(r => r.tag);
    expect(tags).toEqual(['p', 'p']);
  });

  test('self-closing elements are included', () => {
    const source = `export default () => <input type="text" />;`;
    const records = parse(source);
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('input');
  });

  test('component tags lowercased', () => {
    const source = `
import Button from './Button';
export default () => <Button onClick={fn}>Click</Button>;`;
    const records = parse(source);
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('button');
  });

  test('member expression tags (e.g. Foo.Bar) lowercased with dot', () => {
    const source = `
import * as Icons from './icons';
export default () => <Icons.Close />;`;
    const records = parse(source);
    // Member expression: tag = "icons.close"
    expect(records).toHaveLength(1);
    expect(records[0].tag).toContain('.');
  });

  test('file path backslashes are normalized to forward slashes in id', () => {
    const winPath = 'C:\\Users\\srivarsan\\src\\App.tsx';
    const records = parseJSXElements(`export default () => <div />;`, winPath);
    expect(records[0].id).not.toContain('\\');
    expect(records[0].id).toContain('/');
  });

  test('each record has unique line or col', () => {
    const source = `
export default function App() {
  return (
    <div>
      <span />
      <em />
    </div>
  );
}`;
    const records = parse(source);
    expect(records.length).toBeGreaterThanOrEqual(3);
    // All ids should be unique
    const ids = records.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('col is 1-indexed (first char = col 1)', () => {
    // <div> starts at column 0 in babel (0-indexed), so col should be 1
    const source = `<div />;`;
    const records = parse(source);
    expect(records[0].col).toBeGreaterThanOrEqual(1);
  });

  test('handles TypeScript generics and type annotations', () => {
    const source = `
import React from 'react';
interface Props { name: string }
const C: React.FC<Props> = ({ name }) => <p>{name}</p>;
export default C;`;
    const records = parse(source);
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('p');
  });

  test('handles JSX expressions inside attributes', () => {
    const source = `
export default function App() {
  return <div style={{ color: 'red' }}><span /></div>;
}`;
    const records = parse(source);
    expect(records.map(r => r.tag)).toEqual(['div', 'span']);
  });

  test('multiline JSX preserves correct line numbers', () => {
    const source = `
function App() {
  return (
    <section>
      <article />
    </section>
  );
}`;
    const records = parse(source);
    const section = records.find(r => r.tag === 'section')!;
    const article = records.find(r => r.tag === 'article')!;
    expect(section.line).toBeLessThan(article.line);
  });
});
