import * as t from '@babel/types';
import traverseModule from '@babel/traverse';

export interface StructuralChange {
  type: string;
  source?: string;
  sources?: string[];
  parentId?: string;
  siblingId?: string;
  position?: 'before' | 'after';
  newIndex?: number;
  action?: string;
  elementType?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  detached?: boolean;
  workspaceId?: string;
}

export const structuralKinds = new Set(['delete', 'duplicate', 'paste', 'insert', 'group', 'ungroup', 'reorder', 'reparent', 'arrange', 'detach', 'attach', 'workspace-position']);

const traverse = (traverseModule as any).default || traverseModule;
const workspaceAttributes = ['data-gl-workspace-id', 'data-gl-workspace-x', 'data-gl-workspace-y'];

export function workspaceAttribute(node: t.JSXElement, name: string): string | undefined {
  const attribute = node.openingElement.attributes.find(item => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name }));
  return t.isJSXAttribute(attribute) && t.isStringLiteral(attribute.value) ? attribute.value.value : undefined;
}

export function dormantElement(child: t.Node): t.JSXElement | null {
  return t.isJSXExpressionContainer(child) && t.isLogicalExpression(child.expression, { operator: '&&' })
    && t.isBooleanLiteral(child.expression.left, { value: false }) && t.isJSXElement(child.expression.right)
    && workspaceAttribute(child.expression.right, workspaceAttributes[0]) ? child.expression.right : null;
}

/** Structural edits deliberately require direct JSX children, never inferred runtime instances. */
export function mutateStructure(ast: any, target: t.JSXElement, change: StructuralChange,
  resolve: (source: string) => t.JSXElement): void {
  function slotOf(node: t.JSXElement) {
    let result: { parent: t.JSXElement | t.JSXFragment; child: t.JSXElement | t.JSXExpressionContainer } | undefined;
    t.traverseFast(ast, item => {
      if (!t.isJSXElement(item) && !t.isJSXFragment(item)) return;
      for (const child of item.children) {
        if (child === node || dormantElement(child) === node) result = { parent: item, child: child as t.JSXElement | t.JSXExpressionContainer };
      }
    });
    if (!result) throw new Error('UNSUPPORTED_OPERATION: Select a direct JSX child; roots and repeated expression instances cannot be changed structurally.');
    return result;
  }
  function parentOf(node: t.JSXElement): t.JSXElement | t.JSXFragment {
    return slotOf(node).parent;
  }
  function sameScope(first: t.JSXElement, second: t.JSXElement): boolean {
    let a: unknown, b: unknown;
    traverse(ast, { JSXElement(p: any) { if (p.node === first) a = p.scope; if (p.node === second) b = p.scope; } });
    return !!a && a === b;
  }
  function coordinates(required = false) {
    if ((change.x === undefined) !== (change.y === undefined) || (required && change.x === undefined)) {
      throw new Error('INVALID_OPERATION: Both canvas coordinates are required.');
    }
    for (const value of [change.x, change.y]) {
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000000)) {
        throw new Error('INVALID_OPERATION: Invalid canvas coordinates.');
      }
    }
  }
  function setWorkspace(node: t.JSXElement) {
    coordinates(true);
    const id = change.workspaceId || workspaceAttribute(node, workspaceAttributes[0]);
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('INVALID_OPERATION: A stable workspace ID is required.');
    t.traverseFast(ast, item => {
      if (t.isJSXElement(item) && item !== node && workspaceAttribute(item, workspaceAttributes[0]) === id) {
        throw new Error('INVALID_OPERATION: The workspace ID already exists.');
      }
    });
    node.openingElement.attributes = node.openingElement.attributes.filter(item => !t.isJSXAttribute(item)
      || !t.isJSXIdentifier(item.name) || !workspaceAttributes.includes(item.name.name));
    [id, String(change.x), String(change.y)].forEach((value, index) => node.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier(workspaceAttributes[index]), t.stringLiteral(value))));
  }
  function place(node: t.JSXElement) {
    coordinates();
    if (change.x === undefined) return;
    const attributes = node.openingElement.attributes;
    const style = attributes.filter(item => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' }));
    if (style.length > 1 || attributes.some(t.isJSXSpreadAttribute)) throw new Error('UNSUPPORTED_OPERATION: Positioning requires unambiguous style props.');
    const properties = Object.entries({ position: 'absolute', left: `${change.x}px`, top: `${change.y}px` })
      .map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value)));
    if (!style.length) attributes.push(t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(t.objectExpression(properties))));
    else {
      const attribute = style[0] as t.JSXAttribute;
      if (!t.isJSXExpressionContainer(attribute.value) || !t.isObjectExpression(attribute.value.expression)) {
        throw new Error('UNSUPPORTED_OPERATION: Positioning requires an authored style object.');
      }
      const object = attribute.value.expression;
      // Preserve unrelated expressions and spreads, but put explicit placement last.
      object.properties = object.properties.filter(item => !(t.isObjectProperty(item) && !item.computed
        && (t.isIdentifier(item.key) || t.isStringLiteral(item.key))
        && ['position', 'left', 'top'].includes(t.isIdentifier(item.key) ? item.key.name : item.key.value)));
      object.properties.push(...properties);
    }
  }
  function openParent(parent: t.JSXElement) {
    const tag = parent.openingElement.name;
    if (!t.isJSXIdentifier(tag) || /^[A-Z]/.test(tag.name) || ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'embed', 'param', 'source', 'track', 'wbr'].includes(tag.name)) {
      throw new Error('UNSUPPORTED_OPERATION: Choose an authored HTML container as the destination.');
    }
    if (parent.openingElement.attributes.some(attribute => t.isJSXSpreadAttribute(attribute)
      || (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name)
        && ['children', 'dangerouslySetInnerHTML'].includes(attribute.name.name)))) {
      throw new Error('UNSUPPORTED_OPERATION: Destination children are controlled by props or a spread.');
    }
    parent.openingElement.selfClosing = false;
    parent.closingElement ||= t.jsxClosingElement(t.cloneNode(tag));
  }
  function cloneStatic(node: t.JSXElement, acrossScope = false): t.JSXElement {
    function staticExpression(expression: t.Node): boolean {
      if (t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression) || t.isNullLiteral(expression)) return true;
      if (t.isUnaryExpression(expression) && ['+', '-'].includes(expression.operator)) return t.isNumericLiteral(expression.argument);
      if (t.isArrayExpression(expression)) return expression.elements.every(item => item === null || staticExpression(item));
      return t.isObjectExpression(expression) && expression.properties.every(item => t.isObjectProperty(item) && !item.computed && !item.shorthand
        && (t.isIdentifier(item.key) || t.isStringLiteral(item.key) || t.isNumericLiteral(item.key)) && staticExpression(item.value));
    }
    t.traverseFast(node, item => {
      if (acrossScope && t.isJSXOpeningElement(item)
        && (!t.isJSXIdentifier(item.name) || /^[A-Z]/.test(item.name.name))) {
        throw new Error('UNSUPPORTED_OPERATION: Moving component references needs verified lexical bindings.');
      }
      if (t.isJSXSpreadAttribute(item) || t.isJSXSpreadChild(item)
        || (t.isJSXAttribute(item) && t.isJSXIdentifier(item.name) && ['id', 'key', 'ref', 'data-gl-source', ...workspaceAttributes].includes(item.name.name))
        || (t.isJSXExpressionContainer(item) && !staticExpression(item.expression))) {
        throw new Error('UNSUPPORTED_OPERATION: Copying dynamic bindings or identity attributes needs an explicit authored boundary.');
      }
    });
    return t.cloneNode(node, true);
  }
  if (change.type === 'insert') {
    if (!['rectangle', 'ellipse', 'frame', 'text'].includes(change.elementType || '')) throw new Error('UNSUPPORTED_OPERATION: Unknown inserted element type.');
    const text = change.elementType === 'text';
    const tag = text ? 'span' : 'div';
    const styles: Record<string, string> = {
      width: `${Math.round(change.width || (text ? 120 : 100))}px`, height: `${Math.round(change.height || (text ? 32 : 100))}px`,
      ...(text ? { display: 'inline-block' } : { backgroundColor: change.elementType === 'frame' ? 'transparent' : '#38bdf8' }),
    };
    for (const size of [change.width, change.height]) {
      if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size <= 0 || size > 10000)) throw new Error('INVALID_OPERATION: Invalid inserted dimensions.');
    }
    if (change.elementType === 'ellipse') styles.borderRadius = '50%';
    const attributes = Object.keys(styles).length ? [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(t.objectExpression(
      Object.entries(styles).map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value))))))] : [];
    openParent(target);
    const inserted = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(tag), attributes), t.jsxClosingElement(t.jsxIdentifier(tag)), text ? [t.jsxText('New text')] : [], false);
    if (change.detached) {
      setWorkspace(inserted);
      target.children.push(t.jsxExpressionContainer(t.logicalExpression('&&', t.booleanLiteral(false), inserted)));
    } else {
      place(inserted);
      target.children.push(inserted);
    }
    return;
  }
  if (change.type === 'paste') {
    if (!change.source) throw new Error('INVALID_OPERATION: Paste needs a copied source.');
    const copy = cloneStatic(resolve(change.source), true);
    openParent(target);
    target.children.push(copy);
    return;
  }
  const { parent, child } = slotOf(target);
  const index = parent.children.indexOf(child);
  if (change.type === 'delete') { parent.children.splice(index, 1); return; }
  if (change.type === 'workspace-position') {
    if (child === target) throw new Error('INVALID_TARGET: Select a detached workspace object.');
    setWorkspace(target);
    return;
  }
  if (change.type === 'detach') {
    if (child !== target) throw new Error('INVALID_TARGET: This object is already detached.');
    setWorkspace(target);
    parent.children.splice(index, 1, t.jsxExpressionContainer(t.logicalExpression('&&', t.booleanLiteral(false), target)));
    return;
  }
  if (change.type === 'attach') {
    if (child === target) throw new Error('INVALID_TARGET: Select a detached workspace object.');
    const destination = change.parentId ? resolve(change.parentId) : parent;
    let cycle = destination === target;
    t.traverseFast(target, item => { if (item === destination) cycle = true; });
    if (cycle) throw new Error('INVALID_TARGET: An element cannot move into itself or its descendants.');
    if (destination !== parent && (!t.isJSXElement(destination) || !sameScope(target, destination))) {
      throw new Error('UNSUPPORTED_OPERATION: Attaching across lexical scopes could change authored bindings.');
    }
    if (t.isJSXElement(destination)) openParent(destination);
    place(target);
    target.openingElement.attributes = target.openingElement.attributes.filter(item => !t.isJSXAttribute(item)
      || !t.isJSXIdentifier(item.name) || !workspaceAttributes.includes(item.name.name));
    if (destination === parent) parent.children.splice(index, 1, target);
    else { parent.children.splice(index, 1); destination.children.push(target); }
    return;
  }
  if (child !== target) throw new Error('UNSUPPORTED_OPERATION: Attach the workspace object before changing its structure.');
  if (change.type === 'duplicate') { parent.children.splice(index + 1, 0, cloneStatic(target)); return; }
  if (change.type === 'ungroup') {
    if (!t.isJSXIdentifier(target.openingElement.name, { name: 'div' }) || target.openingElement.attributes.length) {
      throw new Error('UNSUPPORTED_OPERATION: Ungroup only a plain wrapper without props or styles.');
    }
    parent.children.splice(index, 1, ...target.children);
    return;
  }
  if (change.type === 'group') {
    if (!change.sources || change.sources.length < 2) throw new Error('INVALID_OPERATION: Group needs at least two source children.');
    const selected = change.sources.map(resolve);
    if (!selected.includes(target)) throw new Error('INVALID_TARGET: The group must include the selected target.');
    if (new Set(selected).size !== selected.length || selected.some(node => parentOf(node) !== parent)) throw new Error('INVALID_TARGET: Group targets must be distinct siblings.');
    const indices = selected.map(node => parent.children.indexOf(node)).sort((a, b) => a - b);
    const first = indices[0], last = indices[indices.length - 1];
    const children = parent.children.slice(first, last + 1);
    if (children.some(node => !selected.includes(node as t.JSXElement) && !(t.isJSXText(node) && !node.value.trim()))) {
      throw new Error('UNSUPPORTED_OPERATION: Group only adjacent siblings without interleaved expressions or text.');
    }
    const wrapper = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('div'), []), t.jsxClosingElement(t.jsxIdentifier('div')), children, false);
    parent.children.splice(first, last - first + 1, wrapper);
    return;
  }
  if (change.type === 'arrange') {
    if (!['front', 'back', 'forward', 'backward'].includes(change.action || '')) throw new Error('INVALID_OPERATION: Unknown arrange action.');
    const siblings = parent.children.filter(t.isJSXElement);
    const at = siblings.indexOf(target);
    const next = change.action === 'front' ? siblings.length - 1 : change.action === 'back' ? 0
      : change.action === 'forward' ? Math.min(at + 1, siblings.length - 1) : Math.max(at - 1, 0);
    if (next === at) return;
    const anchor = siblings[next];
    parent.children.splice(index, 1);
    parent.children.splice(parent.children.indexOf(anchor) + (next > at ? 1 : 0), 0, target);
    return;
  }
  if (change.type === 'reorder' || change.type === 'reparent') {
    if (!change.parentId) throw new Error('INVALID_TARGET: A destination parent is required.');
    const destination = resolve(change.parentId);
    let cycle = destination === target;
    t.traverseFast(target, node => { if (node === destination) cycle = true; });
    if (cycle) throw new Error('INVALID_TARGET: An element cannot move into itself or its descendants.');
    if (destination !== parent && !sameScope(target, destination)) cloneStatic(target, true);
    const sibling = change.siblingId ? resolve(change.siblingId) : null;
    if (sibling && (sibling === target || !destination.children.includes(sibling))) throw new Error('INVALID_TARGET: The sibling must belong to the destination.');
    if (change.position !== undefined && !['before', 'after'].includes(change.position)) throw new Error('INVALID_OPERATION: Invalid sibling position.');
    openParent(destination);
    parent.children.splice(index, 1);
    let next = destination.children.length;
    if (sibling) next = destination.children.indexOf(sibling) + (change.position === 'before' ? 0 : 1);
    else if (change.newIndex !== undefined) {
      const children = destination.children.filter(t.isJSXElement);
      if (!Number.isInteger(change.newIndex) || change.newIndex < 0 || change.newIndex > children.length) throw new Error('INVALID_TARGET: Invalid destination index.');
      next = change.newIndex === children.length ? destination.children.length : destination.children.indexOf(children[change.newIndex]);
    }
    destination.children.splice(next, 0, target);
    return;
  }
  throw new Error('UNSUPPORTED_OPERATION: Unknown structural operation.');
}
