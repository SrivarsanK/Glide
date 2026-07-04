/**
 * FrameworkAdapter interface — each adapter (react, vue, svelte, html) implements this.
 */

import type { StyleChange } from './types.js';

export type AdapterAST = any;
export type AdapterNode = any;

export interface FrameworkAdapter {
  /** Parse a source file and return an AST */
  parseFile(filePath: string, source: string): Promise<AdapterAST>;

  /** Locate a specific node by its 1-indexed line and 0-indexed column */
  resolveNode(ast: AdapterAST, line: number, col: number): AdapterNode | null;

  /** Apply a CSS property change to a node */
  applyStyleChange(node: AdapterNode, change: StyleChange): void;

  /** Reorder children of a parent node */
  reorderChildren(parent: AdapterNode, fromIndex: number, toIndex: number): void;

  /** Serialize AST back to source string, preserving original formatting */
  generate(ast: AdapterAST, originalSource: string): string;
}
