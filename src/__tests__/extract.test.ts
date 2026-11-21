import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

function extract(source: string, marker: string, name: string) {
  const before = source.slice(0, source.indexOf(marker)).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1, change: { type: 'extract', name } } as any]).code;
}
const page = `import { Icon } from './icon';

export default function App() {
  const [count] = useState(0);
  return (
    <main>
      <section className="card">
        <Icon />
        <h2>Pro</h2>
        <p>{'$12'}</p>
      </section>
    </main>
  );
}
`;

test('moves static markup into a named component above, and uses it in its place', () => {
  const code = extract(page, '<section', 'PricingCard');
  expect(code).toMatch(/function PricingCard\(\) \{\s*return \(\s*<section className="card">/);
  expect(code.indexOf('function PricingCard')).toBeLessThan(code.indexOf('export default function App'));
  expect(code).toContain('<main>\n      <PricingCard />\n    </main>');
  expect(code).toContain("import { Icon } from './icon';");
});

test('refuses markup that uses the surrounding component, list items, bad or taken names', () => {
  const uses = page.replace("<p>{'$12'}</p>", '<p>{count}</p>');
  expect(() => extract(uses, '<section', 'Card')).toThrow(/uses `count`/);
  expect(() => extract(page.replace('<section className="card">', '<section key="a">'), '<section', 'Card')).toThrow(/list item/);
  expect(() => extract(page, '<section', 'card')).toThrow(/capital letter/);
  expect(() => extract(page, '<section', 'Icon')).toThrow(/already used/);
  expect(() => extract(page, '<section', 'App')).toThrow(/already used/);
});

test('names bound inside the markup itself are fine', () => {
  const list = page.replace("<p>{'$12'}</p>", '<ul>{[1, 2].map(n => <li key={n}>{n}</li>)}</ul>');
  expect(extract(list, '<section', 'Features')).toContain('function Features()');
});
