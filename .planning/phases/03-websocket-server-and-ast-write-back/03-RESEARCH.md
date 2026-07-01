# Phase 3 Research: WebSocket Server & AST Write-Back

Research and architecture details for establishing a local WebSocket communication server and implementing a non-destructive AST write-back engine for React/Tailwind source files.

## 1. WebSocket Server Architecture (ws)

The Glide local server runs in Node.js during development.
- **Port**: Default is `7777` (with fallbacks if in use).
- **Protocol**: Raw WebSockets using the `ws` package.
- **Messages**:
  - Client-to-server:
    ```typescript
    interface EditMessage {
      type: 'edit';
      file: string;      // e.g., "src/components/Card.tsx"
      line: number;      // 1-based coordinate
      column: number;    // 1-based coordinate
      change: {
        type: 'style' | 'class';
        property: string; // e.g., "marginLeft" or "className"
        value: any;      // e.g., 16 or "ml-4"
      };
    }
    ```
  - Server-to-client:
    ```typescript
    interface ServerMessage {
      type: 'status';
      success: boolean;
      error?: string;
    }
    ```

## 2. AST Parsing and Target Node Resolution

To locate the JSX element to edit:
1. Load file content from disk.
2. Parse into AST using `@babel/parser` with support for JSX and TypeScript:
   ```typescript
   import { parse } from '@babel/parser';
   const ast = parse(sourceCode, {
     sourceType: 'module',
     plugins: ['jsx', 'typescript']
   });
   ```
3. Use `@babel/traverse` to find JSX elements matching the target coordinates:
   - Match by start location: `node.loc.start.line === targetLine` and `node.loc.start.column === targetColumn - 1`.
   - Return the AST node and its parent path.

## 3. Non-Destructive Write-Back Engine

To preserve developer comments, formatting, indentation, and structure outside the edited node:
- **Avoid complete AST generation**: Running `@babel/generator` on the entire file will reformat the whole file and strip comments/styling.
- **Recast Slicing Strategy**:
  1. Identify the target JSX node's attributes list in the AST.
  2. Parse the target `className` attribute or inject a new one.
  3. Determine the start and end character indexes (`node.start`, `node.end`) of the `className` attribute value or the element tag in the original string.
  4. Perform a string slice replacement: `original.slice(0, start) + replacementValue + original.slice(end)`.
  5. Write the modified string back to the file.
This guarantees 100% non-destructive edits because only the modified JSX attribute string slice is touched.

### Editing JSX Attributes
For `className` changes (Tailwind):
- If the element already has a `className="..."` attribute:
  - Locate `JSXAttribute` where `name.name === 'className'`.
  - Locate its value node (`StringLiteral`).
  - Calculate `start` and `end` character indexes.
  - Compute the new class string (e.g., merge or replace classes) and replace the slice.
- If the element has no `className` attribute:
  - Locate the insertion index right after the JSX tag name (e.g., `<div` -> insert space and `className="..."` right after `div`).
