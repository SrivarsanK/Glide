import { parse as recastParse } from 'recast';
import * as babelParser from 'recast/parsers/babel.js';
import getBabelOptions from 'recast/parsers/_babel_options.js';
import traverseModule from '@babel/traverse';

const tsxParser = {
  parse(source: string, options?: any) {
    const getOpts = (getBabelOptions as any).default || getBabelOptions;
    const babelOptions = getOpts(options);
    babelOptions.plugins = babelOptions.plugins.filter((p: string) => p !== 'flow');
    babelOptions.plugins.push('jsx', 'typescript', 'decoratorAutoAccessors');
    return babelParser.parser.parse(source, babelOptions);
  }
};

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
    ast = recastParse(source, { parser: tsxParser });
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
          return [name.object?.name, name.property?.name].filter(Boolean).join('.').toLowerCase();
        }
        return 'unknown';
      })();
      results.push({ id: `${normalizedFile}:${line}:${col}`, tag, line, col });
    },
  });

  return results;
}

