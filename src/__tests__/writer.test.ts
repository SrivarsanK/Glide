import { describe, expect, test } from 'vitest';
import { findJSXElementAt, updateClassName, updateJSXText } from '../writer.js';

describe('AST Write-back Engine', () => {
  test('should find a JSX opening element by coordinates', () => {
    const code = `
      export function Button() {
        return (
          <button className="btn">
            Click me
          </button>
        );
      }
    `;

    // Coordinates for <button ...> (line 4, column 11)
    const node = findJSXElementAt(code, 4, 11);
    expect(node).not.toBeNull();
    expect(node.name.name).toBe('button');
  });

  test('should modify an existing className attribute and keep formatting', () => {
    const code = `
      export function Card() {
        // Important container
        return (
          <div className="card shadow">
            <h3>Title</h3>
          </div>
        );
      }
    `;

    // Coordinates for <div ...> (line 5, column 11)
    const result = updateClassName(code, 5, 11, 'className', 'card shadow rounded');
    
    expect(result).toContain('className="card shadow rounded"');
    // Ensure comment and indentation are preserved
    expect(result).toContain('// Important container');
    expect(result).toContain('<h3>Title</h3>');
  });

  test('should inject className if missing', () => {
    const code = `
      export function Text() {
        return (
          <span>
            Some text
          </span>
        );
      }
    `;

    // Coordinates for <span> (line 4, column 11)
    const result = updateClassName(code, 4, 11, 'className', 'text-red');
    
    expect(result).toContain('<span className="text-red">');
  });

  test('should translate style properties to Tailwind classes', () => {
    const code = `
      export function Box() {
        return (
          <div className="bg-white ml-2">
            Box
          </div>
        );
      }
    `;

    // Coordinates for <div ...> (line 4, column 11)
    const result = updateClassName(code, 4, 11, 'marginLeft', 16);
    
    // ml-2 should be replaced by ml-4
    expect(result).toContain('className="bg-white ml-4"');
  });

  test('should support active breakpoint prefix editing', () => {
    const code = `
      export function Box() {
        return (
          <div className="bg-white ml-2 md:ml-4">
            Box
          </div>
        );
      }
    `;

    // Coordinates for <div ...> (line 4, column 11), edit marginLeft under 'md' breakpoint
    const result = updateClassName(code, 4, 11, 'marginLeft', 32, 'md');

    // md:ml-4 should be replaced with md:ml-8; original ml-2 should be untouched!
    expect(result).toContain('className="bg-white ml-2 md:ml-8"');
  });

  test('should insert new breakpoint prefixed class when not present', () => {
    const code = `
      export function Box() {
        return (
          <div className="bg-white ml-2">
            Box
          </div>
        );
      }
    `;

    // Edit marginLeft under 'sm' breakpoint
    const result = updateClassName(code, 4, 11, 'marginLeft', 16, 'sm');

    // sm:ml-4 should be added; ml-2 should be untouched
    expect(result).toContain('className="bg-white ml-2 sm:ml-4"');
  });

  test('should modify the inner text child of a JSX element', () => {
    const code = `
      export function Heading() {
        return (
          <h1>
            Original Title
          </h1>
        );
      }
    `;

    // Coordinates for <h1> (line 4, column 11)
    const result = updateJSXText(code, 4, 11, 'Updated Title');
    // Format is preserved (whitespace around text kept), only the text is replaced
    expect(result).toContain('Updated Title');
    expect(result).not.toContain('Original Title');
    expect(result).toContain('<h1>');
  });

  test('should support relative spacing modifications (nudge)', () => {
    const code = `
      export function Box() {
        return (
          <div className="bg-white ml-4">
            Box
          </div>
        );
      }
    `;

    // Coordinates for <div ...> (line 4, column 11), decrease margin by 4px
    const result = updateClassName(code, 4, 11, 'marginLeft', '-=4px');
    // ml-4 (16px) - 4px = 12px -> ml-3
    expect(result).toContain('className="bg-white ml-3"');
  });
});

