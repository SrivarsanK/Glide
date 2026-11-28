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

test('refuses `this` and writes that belong to the component around the markup', () => {
  const classPage = 'class App extends React.Component {\n  render() {\n    return <main><section>{this.props.title}</section></main>;\n  }\n}\n';
  expect(() => extract(classPage, '<section', 'Hero')).toThrow(/`this`/);
  const refPage = 'function App() {\n  let input;\n  return <main><section><input ref={node => { input = node; }} /></section></main>;\n}\n';
  expect(() => extract(refPage, '<section', 'Hero')).toThrow(/changes `input`/);
  const destructured = 'function App() {\n  let a;\n  return <main><section onClick={() => { [a] = [1]; }}>A</section></main>;\n}\n';
  expect(() => extract(destructured, '<section', 'Hero')).toThrow(/changes `a`/);
  // A function inside the markup owns its own `this` and its own variables.
  const own = 'function App() {\n  return <main><section onClick={function () { let n = 0; n = 1; this.blur(); }}>A</section></main>;\n}\n';
  expect(extract(own, '<section', 'Hero')).toContain('function Hero()');
});

test('handles JSX member properties, super, arguments, generic type params, and detached targets', () => {
  const memberProp = "import { UI } from './ui';\nfunction App() {\n  const Header = 'local';\n  return <main><section><UI.Header /></section></main>;\n}\n";
  expect(extract(memberProp, '<section', 'Banner')).toContain('function Banner()');

  const usesSuper = 'class App extends Base {\n  render() {\n    return <main><section onClick={() => super.save()}>A</section></main>;\n  }\n}\n';
  expect(() => extract(usesSuper, '<section', 'Hero')).toThrow(/`super`/);

  const usesArgs = 'function App() {\n  return <main><section>{arguments[0]}</section></main>;\n}\n';
  expect(() => extract(usesArgs, '<section', 'Hero')).toThrow(/`arguments`/);

  const usesGeneric = 'function App<T>() {\n  return <main><section onClick={(x: T) => x}>A</section></main>;\n}\n';
  expect(() => extract(usesGeneric, '<section', 'Hero')).toThrow(/type parameter `T`/);

  const detached = 'function App() {\n  return <main>{false && <section data-gl-workspace-id="w1" data-gl-workspace-x="0" data-gl-workspace-y="0">Draft</section>}</main>;\n}\n';
  expect(() => extract(detached, '<section', 'Hero')).toThrow(/Attach the workspace object/);
});
