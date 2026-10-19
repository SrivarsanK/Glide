import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { dormantElement, workspaceAttribute } from './structure.js';

export interface WorkspacePreview {
  tagName: string;
  text: string;
  styles: Record<string, string | number>;
  children: WorkspacePreview[];
}

export interface WorkspaceObject extends WorkspacePreview {
  id: string;
  file: string;
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Derive pasteboard previews from inactive authored JSX, without evaluating code. */
export function listWorkspaceObjects(code: string, file: string): WorkspaceObject[] {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const result: WorkspaceObject[] = [];
  function preview(node: t.JSXElement): WorkspacePreview {
    const name = node.openingElement.name;
    const tagName = t.isJSXIdentifier(name) && /^[a-z][a-z0-9-]*$/.test(name.name) ? name.name : 'div';
    const styles: Record<string, string | number> = {};
    const style = node.openingElement.attributes.find(item => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' }));
    if (t.isJSXAttribute(style) && t.isJSXExpressionContainer(style.value) && t.isObjectExpression(style.value.expression)) {
      for (const prop of style.value.expression.properties) {
        if (!t.isObjectProperty(prop) || prop.computed || (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key))) continue;
        const key = t.isIdentifier(prop.key) ? prop.key.name : prop.key.value;
        if (t.isStringLiteral(prop.value) || t.isNumericLiteral(prop.value)) styles[key] = prop.value.value;
      }
    }
    const text = node.children.map(child => t.isJSXText(child) ? child.value
      : t.isJSXExpressionContainer(child) && (t.isStringLiteral(child.expression) || t.isNumericLiteral(child.expression)) ? String(child.expression.value) : '').join('').trim();
    return { tagName, styles, text, children: node.children.filter(t.isJSXElement).map(preview) };
  }
  function size(value: string | number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && /^\d+(?:\.\d+)?(?:px)?$/.test(value) && Number.parseFloat(value) > 0) return Number.parseFloat(value);
    return fallback;
  }
  t.traverseFast(ast, node => {
    const element = dormantElement(node);
    if (!element || !element.loc) return;
    const x = Number(workspaceAttribute(element, 'data-gl-workspace-x'));
    const y = Number(workspaceAttribute(element, 'data-gl-workspace-y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const display = preview(element);
    const normalizedFile = file.replace(/\\/g, '/');
    result.push({ ...display, id: workspaceAttribute(element, 'data-gl-workspace-id')!, file: normalizedFile,
      source: `${normalizedFile}:${element.loc.start.line}:${element.loc.start.column + 1}`,
      x, y, width: size(display.styles.width, display.text ? 120 : 100), height: size(display.styles.height, display.text ? 32 : 100) });
  });
  return result;
}
