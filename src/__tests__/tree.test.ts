import { describe, expect, test } from 'vitest';
import { buildComponentTree, getNestingPath } from '../../packages/core/src/tree.js';

describe('JSX Component Tree Parser', () => {
  test('should parse nested JSX elements into tree structures', () => {
    const code = `
      export function Page() {
        return (
          <div data-gl-source="src/Page.tsx:4:11">
            <header data-gl-source="src/Page.tsx:5:13">
              <h1 data-gl-source="src/Page.tsx:6:15">Title</h1>
            </header>
            <main data-gl-source="src/Page.tsx:8:13">
              <section data-gl-source="src/Page.tsx:9:15">
                <Card.Body data-gl-source="src/Page.tsx:10:17">Content</Card.Body>
              </section>
            </main>
          </div>
        );
      }
    `;

    const tree = buildComponentTree(code);

    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.name).toBe('div');
    expect(root.id).toBe('src/Page.tsx:4:11');
    expect(root.children).toHaveLength(2);

    const [header, main] = root.children;
    expect(header.name).toBe('header');
    expect(header.children).toHaveLength(1);
    expect(header.children[0].name).toBe('h1');

    expect(main.name).toBe('main');
    expect(main.children).toHaveLength(1);
    expect(main.children[0].name).toBe('section');
    expect(main.children[0].children).toHaveLength(1);
    expect(main.children[0].children[0].name).toBe('Card.Body');
  });

  test('should resolve selected element breadcrumb paths', () => {
    const code = `
      export function Panel() {
        return (
          <div data-gl-source="root">
            <ul data-gl-source="list">
              <li data-gl-source="item-1">One</li>
              <li data-gl-source="item-2">Two</li>
            </ul>
          </div>
        );
      }
    `;

    const tree = buildComponentTree(code);
    const path = getNestingPath(tree, 'item-2');

    expect(path).toEqual(['div', 'ul', 'li']);
  });

  test('should return empty array for non-existent selection id', () => {
    const code = `
      export function Panel() {
        return (
          <div data-gl-source="root">
            <span>Text</span>
          </div>
        );
      }
    `;

    const tree = buildComponentTree(code);
    const path = getNestingPath(tree, 'unknown-id');

    expect(path).toEqual([]);
  });
});
