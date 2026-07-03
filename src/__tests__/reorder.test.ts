import { describe, expect, test } from 'vitest';
import { reorderJSXElement } from '../reorder.js';

describe('AST Layer Reordering', () => {
  test('should reorder sibling elements within the same parent', () => {
    const code = `
      export function List() {
        return (
          <ul data-gl-source="parent">
            <li data-gl-source="item-1">Item One</li>
            <li data-gl-source="item-2">Item Two</li>
            <li data-gl-source="item-3">Item Three</li>
          </ul>
        );
      }
    `;

    // Move item-3 before item-1
    const updated = reorderJSXElement(code, 'item-3', 'parent', 'item-1', 'before');

    expect(updated).toContain('<li data-gl-source="item-3">Item Three</li><li data-gl-source="item-1">Item One</li>');
  });

  test('should move element to a different parent container', () => {
    const code = `
      export function App() {
        return (
          <div data-gl-source="root">
            <header data-gl-source="header">
              <span data-gl-source="target">Target Text</span>
            </header>
            <main data-gl-source="main">
              <p>Main content</p>
            </main>
          </div>
        );
      }
    `;

    // Move target element to be a child of main container
    const updated = reorderJSXElement(code, 'target', 'main', null, 'after');

    expect(updated).not.toContain('<header data-gl-source="header">\n              <span data-gl-source="target">Target Text</span>\n            </header>');
    expect(updated).toContain('<main data-gl-source="main">\n              <p>Main content</p>\n            <span data-gl-source="target">Target Text</span></main>');
  });

  test('should keep comments and unrelated variables untouched', () => {
    const code = `
      // Helper variable
      const title = "Welcome";

      export function Banner() {
        // Render banner
        return (
          <div data-gl-source="banner">
            <h1 data-gl-source="h1">{title}</h1>
            <p data-gl-source="p">Subtitle</p>
          </div>
        );
      }
    `;

    // Reorder subtitle (p) before h1
    const updated = reorderJSXElement(code, 'p', 'banner', 'h1', 'before');

    expect(updated).toContain('const title = "Welcome";');
    expect(updated).toContain('// Helper variable');
    expect(updated).toContain('// Render banner');
    expect(updated).toContain('<p data-gl-source="p">Subtitle</p>');
  });
});

import { groupJSXElements, ungroupJSXElement } from '../reorder.js';

describe('AST Group & Ungroup', () => {
  test('should wrap selected sibling elements in a container div', () => {
    const code = `
      export function Banner() {
        return (
          <div data-gl-source="banner">
            <h1 data-gl-source="h1">Title</h1>
            <p data-gl-source="p">Subtitle</p>
          </div>
        );
      }
    `;

    const updated = groupJSXElements(code, ['h1', 'p']);
    expect(updated).toContain('style={{');
    expect(updated).toContain('position: "relative"');
    expect(updated).toContain('<h1 data-gl-source="h1">Title</h1>');
    expect(updated).toContain('<p data-gl-source="p">Subtitle</p>');
  });

  test('should ungroup nested children back into parent container', () => {
    const code = `
      export function Banner() {
        return (
          <div data-gl-source="banner">
            <div data-gl-source="group-1">
              <h1 data-gl-source="h1">Title</h1>
              <p data-gl-source="p">Subtitle</p>
            </div>
          </div>
        );
      }
    `;

    const updated = ungroupJSXElement(code, 'group-1');
    expect(updated).not.toContain('group-1');
    expect(updated).toContain('<div data-gl-source="banner">');
    expect(updated).toContain('<h1 data-gl-source="h1">Title</h1>');
  });
});
