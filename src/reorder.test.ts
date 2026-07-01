import { describe, expect, test } from 'vitest';
import { reorderJSXElement } from './reorder.js';

describe('AST Layer Reordering', () => {
  test('should reorder sibling elements within the same parent', () => {
    const code = `
      export function List() {
        return (
          <ul data-cf-source="parent">
            <li data-cf-source="item-1">Item One</li>
            <li data-cf-source="item-2">Item Two</li>
            <li data-cf-source="item-3">Item Three</li>
          </ul>
        );
      }
    `;

    // Move item-3 before item-1
    const updated = reorderJSXElement(code, 'item-3', 'parent', 'item-1', 'before');

    expect(updated).toContain('<li data-cf-source="item-3">Item Three</li><li data-cf-source="item-1">Item One</li>');
  });

  test('should move element to a different parent container', () => {
    const code = `
      export function App() {
        return (
          <div data-cf-source="root">
            <header data-cf-source="header">
              <span data-cf-source="target">Target Text</span>
            </header>
            <main data-cf-source="main">
              <p>Main content</p>
            </main>
          </div>
        );
      }
    `;

    // Move target element to be a child of main container
    const updated = reorderJSXElement(code, 'target', 'main', null, 'after');

    expect(updated).not.toContain('<header data-cf-source="header">\n              <span data-cf-source="target">Target Text</span>\n            </header>');
    expect(updated).toContain('<main data-cf-source="main">\n              <p>Main content</p>\n            <span data-cf-source="target">Target Text</span></main>');
  });

  test('should keep comments and unrelated variables untouched', () => {
    const code = `
      // Helper variable
      const title = "Welcome";

      export function Banner() {
        // Render banner
        return (
          <div data-cf-source="banner">
            <h1 data-cf-source="h1">{title}</h1>
            <p data-cf-source="p">Subtitle</p>
          </div>
        );
      }
    `;

    // Reorder subtitle (p) before h1
    const updated = reorderJSXElement(code, 'p', 'banner', 'h1', 'before');

    expect(updated).toContain('const title = "Welcome";');
    expect(updated).toContain('// Helper variable');
    expect(updated).toContain('// Render banner');
    expect(updated).toContain('<p data-cf-source="p">Subtitle</p>');
  });
});
