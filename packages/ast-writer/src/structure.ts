import * as t from '@babel/types';
import traverseModule from '@babel/traverse';
import { setAttribute } from './props.js';

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
  tagName?: string;
  /** Attributes a retag sets (or removes with null) before checking the new tag, in one transaction. */
  attributes?: Record<string, string | true | null>;
  /** False when the user clicked instead of dragging, so the size is only a default. */
  drawn?: boolean;
  /** The component name an `extract` change creates. */
  name?: string;
}

export const structuralKinds = new Set(['delete', 'duplicate', 'paste', 'insert', 'group', 'ungroup', 'reorder', 'reparent', 'arrange', 'detach', 'attach', 'workspace-position', 'retag', 'extract']);

const RETAG_TARGETS = new Set(['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'ul', 'ol', 'li', 'a', 'button',
  'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'figure', 'figcaption']);
// Flow content a paragraph cannot hold (it takes phrasing content only).
const BLOCK_TAGS = new Set(['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'ul', 'ol', 'li', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'figcaption', 'form', 'table', 'pre', 'blockquote', 'dl', 'dt', 'dd',
  'hr', 'address', 'fieldset', 'details', 'dialog', 'menu', 'hgroup', 'search']);
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'label']);
const tagOf = (node: t.Node): string | null => t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name) ? node.openingElement.name.name : null;
/** Whether a binding is declared inside the extracted markup itself (such as a callback parameter). */
const isInside = (inner: any, outer: any) => !!inner?.findParent((q: any) => q === outer);
const attributeOf = (node: t.JSXElement, name: string) => node.openingElement.attributes.find((a): a is t.JSXAttribute => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name }));

const traverse = (traverseModule as any).default || traverseModule;

function inlineStyles(node: t.JSXElement, styles: Record<string, string>): void {
  node.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(t.objectExpression(
    Object.entries(styles).map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value)))))));
}
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
  resolve: (source: string) => t.JSXElement,
  /** Writes a new element's starting styles in the project's format; inline styles without it. */
  applyStyles: (node: t.JSXElement, styles: Record<string, string>) => void = inlineStyles): void {
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
  if (change.type === 'extract') {
    // shortcut: the component goes into the same file (one file, one transaction, normal undo); a file of its own needs multi-file undo first.
    const name = change.name || '';
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error('INVALID_OPERATION: A component name starts with a capital letter and uses only letters and digits, like PricingCard.');
    if (attributeOf(target, 'key')) throw new Error('UNSUPPORTED_OPERATION: This element is a list item (it has a key). Extract the content inside it instead.');
    let found = false;
    traverse(ast, { JSXElement(p: any) {
      if (p.node !== target) return;
      found = true;
      if (p.scope.getProgramParent().hasBinding(name) || p.scope.hasBinding(name)) throw new Error(`INVALID_OPERATION: ${name} is already used in this file.`);
      // The markup moves to module level, so it may only use names defined there or globally.
      p.traverse({ 'Identifier|JSXIdentifier'(inner: any) {
        const id = inner.node.name;
        const reference = inner.isJSXIdentifier() ? inner.parentPath.isJSXOpeningElement() || inner.parentPath.isJSXClosingElement() || inner.parentPath.isJSXMemberExpression() : inner.isReferencedIdentifier();
        if (!reference || (inner.isJSXIdentifier() && /^[a-z]/.test(id) && !inner.parentPath.isJSXMemberExpression())) return;
        const binding = inner.scope.getBinding(id);
        if (binding && binding.scope.block !== p.scope.getProgramParent().block && !isInside(binding.path, p)) {
          throw new Error(`UNSUPPORTED_OPERATION: The markup uses \`${id}\` from the component around it. Pass it as a prop in source, then extract.`);
        }
      }, ThisExpression(inner: any) {
        // An arrow function shares the `this` around it; any other function has its own.
        let owner = inner.getFunctionParent();
        while (owner && owner.isArrowFunctionExpression()) owner = owner.getFunctionParent();
        if (!owner || !isInside(owner, p)) throw new Error('UNSUPPORTED_OPERATION: The markup uses `this` from the component around it. Pass the values as props in source, then extract.');
      } });
      // Writes count too (`ref={node => { input = node; }}`): reads alone miss assignment targets.
      for (let scope = p.scope; scope && scope !== p.scope.getProgramParent(); scope = scope.parent) {
        for (const [id, binding] of Object.entries(scope.bindings) as [string, any][]) {
          if (binding.constantViolations.some((write: any) => isInside(write, p))) {
            throw new Error(`UNSUPPORTED_OPERATION: The markup changes \`${id}\` from the component around it. Move that logic into the markup's own component in source.`);
          }
        }
      }
      const statement = p.findParent((q: any) => q.parentPath?.isProgram());
      if (!statement) throw new Error('UNSUPPORTED_OPERATION: This markup is not inside a module-level component.');
      statement.insertBefore(t.functionDeclaration(t.identifier(name), [], t.blockStatement([t.returnStatement(target)])));
      p.replaceWith(t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(name), [], true), null, [], true));
      p.stop();
    } });
    if (!found) throw new Error('INVALID_TARGET: The element was not found.');
    return;
  }
  if (change.type === 'retag') {
    const from = tagOf(target), to = change.tagName || '';
    if (!from || !/^[a-z]/.test(from)) throw new Error('UNSUPPORTED_OPERATION: Only HTML elements can change their tag; a component decides what it renders.');
    if (!RETAG_TARGETS.has(to)) throw new Error(`UNSUPPORTED_OPERATION: <${to}> is not a tag the editor can switch to.`);
    if (target.openingElement.attributes.some(t.isJSXSpreadAttribute)) throw new Error('UNSUPPORTED_OPERATION: A spread may set attributes the new tag depends on; change the tag in source.');
    // An interaction (B1) changes the tag and its attributes together, so the attributes go first.
    for (const [name, value] of Object.entries(change.attributes || {})) setAttribute(ast, target, name, value);
    if (from === to) return;
    // HTML validity checks that the source alone can decide.
    const ancestors: string[] = [];
    traverse(ast, { JSXElement(p: any) { if (p.node === target) p.findParent((q: any) => { const tag = tagOf(q.node); if (tag) ancestors.push(tag); return false; }); } });
    const descendants: t.JSXElement[] = [];
    t.traverseFast(target, item => { if (item !== target && t.isJSXElement(item)) descendants.push(item); });
    // Fragments are transparent: their children render as this element's children.
    const rendered = (node: t.JSXElement | t.JSXFragment): string[] => node.children.flatMap(child => t.isJSXFragment(child) ? rendered(child) : tagOf(child) ?? []);
    const childTags = rendered(target);
    if ((to === 'a' || to === 'button') && ancestors.some(tag => tag === 'a' || tag === 'button')) {
      throw new Error(`UNSUPPORTED_OPERATION: A <${to}> cannot sit inside a link or button.`);
    }
    if ((to === 'a' || to === 'button') && descendants.some(item => INTERACTIVE_TAGS.has(tagOf(item) ?? '') || attributeOf(item, 'tabIndex'))) {
      throw new Error(`UNSUPPORTED_OPERATION: A <${to}> cannot contain links, buttons or form fields.`);
    }
    if (to === 'li' && !['ul', 'ol'].includes(ancestors[0] ?? '')) throw new Error('UNSUPPORTED_OPERATION: A list item must sit directly in a <ul> or <ol>.');
    if (from === 'li' && ['ul', 'ol'].includes(ancestors[0] ?? '')) throw new Error('UNSUPPORTED_OPERATION: A list holds list items; change the list first.');
    if ((from === 'ul' || from === 'ol') && to !== 'ul' && to !== 'ol' && childTags.includes('li')) {
      throw new Error('UNSUPPORTED_OPERATION: Its list items need a list; change them first.');
    }
    if (to === 'p' && descendants.some(item => BLOCK_TAGS.has(tagOf(item) ?? ''))) throw new Error('UNSUPPORTED_OPERATION: A paragraph cannot contain block elements.');
    if (BLOCK_TAGS.has(to) && ancestors.includes('p')) throw new Error(`UNSUPPORTED_OPERATION: A <${to}> cannot sit inside a paragraph.`);
    // Attributes that only mean something on the old tag are removed first, so nothing is dropped silently.
    for (const [tag, names] of [['a', ['href', 'target', 'rel']], ['button', ['type']]] as const) {
      const left = from === tag && to !== tag ? names.find(name => attributeOf(target, name)) : undefined;
      if (left) throw new Error(`UNSUPPORTED_OPERATION: Remove ${left} first; it only applies to <${tag}>.`);
    }
    if (to === 'button') {
      const type = attributeOf(target, 'type');
      if (type && !(t.isStringLiteral(type.value) && type.value.value === 'button')) throw new Error('UNSUPPORTED_OPERATION: Remove type first; a button here gets type="button".');
      // A button inside a form submits it unless it says otherwise.
      if (!type) target.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('button')));
    }
    (target.openingElement.name as t.JSXIdentifier).name = to;
    if (target.closingElement) (target.closingElement.name as t.JSXIdentifier).name = to;
    return;
  }
  if (change.type === 'insert') {
    if (!['rectangle', 'ellipse', 'frame', 'text'].includes(change.elementType || '')) throw new Error('UNSUPPORTED_OPERATION: Unknown inserted element type.');
    const text = change.elementType === 'text';
    const tag = text ? 'span' : 'div';
    const styles: Record<string, string> = {
      width: `${Math.round(change.width || (text ? 120 : 100))}px`, height: `${Math.round(change.height || (text ? 32 : 100))}px`,
      // A frame starts without a fill, so it adds no color the user did not choose.
      ...(text ? { display: 'inline-block' } : change.elementType === 'frame' ? {} : { backgroundColor: '#38bdf8' }),
    };
    for (const size of [change.width, change.height]) {
      if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size <= 0 || size > 10000)) throw new Error('INVALID_OPERATION: Invalid inserted dimensions.');
    }
    if (change.elementType === 'ellipse') styles.borderRadius = '50%';
    openParent(target);
    const inserted = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(tag), []), t.jsxClosingElement(t.jsxIdentifier(tag)), text ? [t.jsxText('New text')] : [], false);
    const kids = target.children;
    const blank = (child: t.Node | undefined): child is t.JSXText => t.isJSXText(child) && !child.value.trim();
    // Give the new child its own line, indented like its siblings, when the children are on separate lines.
    const addChild = (child: t.JSXElement | t.JSXExpressionContainer, at: number) => {
      const separator = kids.find((item, i) => blank(item) && item.value.includes('\n') && i + 1 < kids.length && !blank(kids[i + 1]));
      const loc = target.loc;
      // An empty parent written over several lines gets its first child on a line of its own, one level deeper.
      if (!separator && loc && loc.start.line !== loc.end.line && kids.every(item => blank(item))) {
        const indent = ' '.repeat(loc.start.column);
        kids.splice(0, kids.length, ...([t.jsxText(`\n${indent}  `), child, t.jsxText(`\n${indent}`)] as typeof kids));
      } else if (!separator) kids.splice(at, 0, child);
      else if (blank(kids[at - 1])) kids.splice(at, 0, child, t.jsxText((separator as t.JSXText).value));
      else kids.splice(at, 0, t.jsxText((separator as t.JSXText).value), child);
    };
    // Without a sibling the child goes last, before the whitespace that indents the closing tag.
    const last = blank(kids[kids.length - 1]) ? kids.length - 1 : kids.length;
    if (change.detached) {
      // The pasteboard previews read inline styles only.
      inlineStyles(inserted, styles);
      setWorkspace(inserted);
      addChild(t.jsxExpressionContainer(t.logicalExpression('&&', t.booleanLiteral(false), inserted)), last);
      return;
    }
    // In the page, a frame lays out what is drawn into it, and text hugs its content
    // (a fixed height would clip it); drafts above keep a fixed box for the preview.
    const flow: Record<string, string> = change.elementType === 'frame' ? { ...styles, display: 'flex', flexDirection: 'column', gap: '16px' }
      : text ? (change.width && change.drawn !== false ? { display: 'inline-block', width: styles.width } : {}) : styles;
    if (Object.keys(flow).length) applyStyles(inserted, flow);
    place(inserted);
    // Join the layout beside the child nearest the drawn point.
    const sibling = change.siblingId ? resolve(change.siblingId) : undefined;
    // A sibling inside a fragment or `{…}` renders as a child but is not one in source: its direct child is the boundary.
    const index = sibling ? kids.findIndex(kid => { let found = false; t.traverseFast(kid, node => { if (node === sibling) found = true; }); return found; }) : -1;
    addChild(inserted, index < 0 ? last : change.position === 'before' ? index : index + 1);
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
