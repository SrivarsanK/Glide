import { describe, test, expect } from 'vitest';
import { updateHTMLClass, updateHTMLText, parseHTMLToReact } from '../html.js';
import * as React from 'react';

describe('HTML DOM Parsing and Modification Engine', () => {
  test('should parse HTML and update classes', () => {
    const html = `
      <div>
        <h1 data-gl-source="src/index.html:3:9" class="old-class">Title</h1>
        <p>Paragraph</p>
      </div>
    `;

    const updated = updateHTMLClass(html, 'src/index.html:3:9', 'new-class border-2');
    expect(updated).toContain('class="new-class border-2"');
    expect(updated).not.toContain('class="old-class"');
    expect(updated).toContain('<p>Paragraph</p>');
  });

  test('should parse HTML and update element text content', () => {
    const html = `
      <div>
        <span data-gl-source="src/index.html:4:5">Original text</span>
      </div>
    `;

    const updated = updateHTMLText(html, 'src/index.html:4:5', 'Fresh updated content');
    expect(updated).toContain('Fresh updated content');
    expect(updated).not.toContain('Original text');
  });

  test('should convert HTML string to React element', () => {
    const element = parseHTMLToReact('<div class="box">Content</div>');
    expect(React.isValidElement(element)).toBe(true);
  });
});
