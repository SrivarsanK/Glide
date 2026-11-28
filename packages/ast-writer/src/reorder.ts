import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = (traverseModule as any).default || traverseModule;

export interface JSXElementRecord {
  /** Same value as the data-gl-source attribute the babel-plugin injects. */
  id: string;
  /** Lower-cased JSX tag name (e.g. "div", "Button"). */
  tag: string;
  /** 1-indexed source line. */
  line: number;
  /** 1-indexed source column. */
  col: number;
}

export function parseJSXElements(
  source: string,
  filePath: string,
): JSXElementRecord[] {
  const results: JSXElementRecord[] = [];

  let ast: any;
  try {
    // Parse with @babel/parser directly so tab columns stay 1:1 with babel-plugin and writer.ts.
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decoratorAutoAccessors'],
    });
  } catch {
    // Not a valid JSX/TSX file — return empty (caller handles gracefully)
    return results;
  }

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const loc = path.node.loc;
      if (!loc) return;
      const line = loc.start.line;
      const col = loc.start.column + 1; // make 1-indexed to match babel-plugin
      const normalizedFile = filePath.replace(/\\/g, '/');
      const tag = (() => {
        const name = path.node.name;
        if (!name) return 'unknown';
        if (name.type === 'JSXIdentifier') return name.name.toLowerCase();
        if (name.type === 'JSXMemberExpression') {
          const parts: string[] = [];
          let cur = name;
          while (cur && cur.type === 'JSXMemberExpression') {
            if (cur.property?.name) parts.unshift(cur.property.name);
            cur = cur.object;
          }
          if (cur?.name) parts.unshift(cur.name);
          return parts.length ? parts.join('.').toLowerCase() : 'unknown';
        }
        if (name.type === 'JSXNamespacedName') {
          return `${name.namespace?.name}:${name.name?.name}`.toLowerCase();
        }
        return 'unknown';
      })();
      results.push({ id: `${normalizedFile}:${line}:${col}`, tag, line, col });
    },
  });

  return results;
}

