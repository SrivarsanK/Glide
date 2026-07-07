/**
 * React/JSX/TSX Framework Adapter.
 * Uses Babel to parse, traverse, and generate JSX source.
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import type { FrameworkAdapter, AdapterAST, AdapterNode, StyleChange } from '@srivarsank/core';

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

export class ReactAdapter implements FrameworkAdapter {
  async parseFile(_filePath: string, source: string): Promise<AdapterAST> {
    return parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  }

  resolveNode(ast: AdapterAST, line: number, col: number): AdapterNode | null {
    let targetNode: AdapterNode = null;

    traverse(ast, {
      JSXOpeningElement(path: any) {
        const loc = path.node.loc;
        if (loc && loc.start.line === line && loc.start.column === col - 1) {
          targetNode = path.node;
          path.stop();
        }
      },
    });

    return targetNode;
  }

  applyStyleChange(node: AdapterNode, change: StyleChange): void {
    // Find or create className attribute and update with Tailwind class
    const attrs = node.attributes || [];
    const classAttr = attrs.find(
      (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className'
    );

    if (classAttr && classAttr.value?.type === 'StringLiteral') {
      // Update existing className
      const existing = classAttr.value.value;
      classAttr.value.value = existing + ' ' + String(change.value);
    } else {
      // Create new className attribute
      const attr = t.jsxAttribute(
        t.jsxIdentifier('className'),
        t.stringLiteral(String(change.value))
      );
      node.attributes.push(attr);
    }
  }

  reorderChildren(parent: AdapterNode, fromIndex: number, toIndex: number): void {
    if (!parent.children) return;
    const [moved] = parent.children.splice(fromIndex, 1);
    parent.children.splice(toIndex, 0, moved);
  }

  generate(ast: AdapterAST, _originalSource: string): string {
    const result = generate(ast, { retainLines: true });
    return result.code;
  }
}

export default ReactAdapter;
