import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const traverse = (traverseModule as any).default || traverseModule;
type Scalar = string | number | boolean;
interface Prop { name: string; kind: string; value?: Scalar; choices?: Scalar[]; reason?: string }

function literal(value: any): Scalar | undefined {
  if (value === null) return true; // JSX shorthand boolean
  if (t.isJSXExpressionContainer(value)) return literal(value.expression);
  if (t.isStringLiteral(value) || t.isNumericLiteral(value) || t.isBooleanLiteral(value)) return value.value;
  if (t.isUnaryExpression(value, { operator: '-' }) && t.isNumericLiteral(value.argument)) return -value.argument.value;
  return undefined;
}

function describe(ast: any, node: t.JSXElement) {
  const name = node.openingElement.name;
  const component = t.isJSXIdentifier(name) && /^[A-Z]/.test(name.name);
  const scope = component ? 'call-site' : 'source-element';
  const schema = new Map<string, Prop>();
  // Only resolve local function declarations and simple parameter annotations.
  // Imported, generic, inherited and computed schemas remain explicitly unknown.
  traverse(ast, { JSXElement(p: any) {
    if (p.node !== node || !component || !t.isJSXIdentifier(name)) return;
    const binding = p.scope.getBinding(name.name)?.path.node;
    const fn = t.isVariableDeclarator(binding) ? binding.init : binding;
    if (!t.isFunctionDeclaration(fn) && !t.isArrowFunctionExpression(fn) && !t.isFunctionExpression(fn)) return;
    const parameter = fn.params[0];
    let annotation: any = parameter && 'typeAnnotation' in parameter ? parameter.typeAnnotation : undefined;
    if (t.isTSTypeAnnotation(annotation)) annotation = annotation.typeAnnotation;
    if (t.isTSTypeReference(annotation) && t.isIdentifier(annotation.typeName)) {
      const matches: any[] = [];
      const typeName = annotation.typeName.name;
      t.traverseFast(ast, item => {
        if ((t.isTSTypeAliasDeclaration(item) || t.isTSInterfaceDeclaration(item)) && item.id.name === typeName) matches.push(item);
      });
      if (matches.length !== 1) return;
      const declaration = matches[0];
      if (declaration.typeParameters || declaration.extends?.length) return;
      annotation = t.isTSTypeAliasDeclaration(declaration) ? declaration.typeAnnotation : declaration.body;
    }
    const members = t.isTSTypeLiteral(annotation) ? annotation.members : t.isTSInterfaceBody(annotation) ? annotation.body : [];
    for (const member of members) {
      if (!t.isTSPropertySignature(member) || member.computed || !t.isIdentifier(member.key)) continue;
      const type = member.typeAnnotation?.typeAnnotation;
      const kind = t.isTSStringKeyword(type) ? 'string' : t.isTSNumberKeyword(type) ? 'number' : t.isTSBooleanKeyword(type) ? 'boolean' : 'unknown';
      const choices = t.isTSUnionType(type) ? type.types.map(item => t.isTSLiteralType(item) ? literal(item.literal) : undefined) : [];
      if (choices.length && choices.every(item => item !== undefined)) schema.set(member.key.name, { name: member.key.name, kind: 'enum', choices: choices as Scalar[] });
      else if (kind !== 'unknown') schema.set(member.key.name, { name: member.key.name, kind });
    }
  } });
  const attributes = node.openingElement.attributes;
  const spread = attributes.some(t.isJSXSpreadAttribute);
  const props = new Map<string, Prop>();
  for (const [key, prop] of schema) props.set(key, { ...prop, reason: 'Not authored here; runtime default or inherited value is unknown.' });
  for (const attr of attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    const key = attr.name.name, value = literal(attr.value);
    const known = schema.get(key);
    props.set(key, { name: key, kind: known?.kind || (value === undefined ? 'dynamic' : typeof value), choices: known?.choices, value,
      reason: value === undefined ? 'Dynamic expression; edit it in source.' : undefined });
  }
  for (const prop of props.values()) {
    if (spread) prop.reason = 'A spread may supply or override this prop; edit it in source.';
    // On HTML elements the attribute editor sets `id`; on components it stays a source-only identity prop.
    if (/^(on[A-Z]|data-gl-)/.test(prop.name) || ['key', 'ref', 'style', 'className', 'dangerouslySetInnerHTML', 'children'].includes(prop.name)
      || (prop.name === 'id' && component)) {
      prop.reason = 'Use the dedicated source control for this property.';
    }
    if (attributes.filter(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: prop.name })).length > 1) prop.reason = 'Duplicate attributes are ambiguous.';
  }
  return { scope, tag: t.isJSXIdentifier(name) ? name.name : 'Component', spread, props: [...props.values()] };
}

export function inspectJSXProps(source: string, line: number, column: number) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  let node: t.JSXElement | undefined;
  t.traverseFast(ast, item => { if (t.isJSXElement(item) && item.loc?.start.line === line && item.loc.start.column === column - 1) node = item; });
  if (!node) throw new Error('INVALID_TARGET: Select an exact authored element.');
  return describe(ast, node);
}

/** HTML attributes the editor may add, change or remove; handlers and identity attributes stay in source. */
const ATTRIBUTES = new Set(['href', 'target', 'rel', 'id', 'type', 'title', 'alt', 'src', 'name', 'placeholder',
  'disabled', 'popover', 'popoverTarget', 'popoverTargetAction', 'role']);
export const isEditableAttribute = (name: string) => ATTRIBUTES.has(name) || /^aria-[a-z]+$/.test(name);
const URL_SCHEMES: Record<string, Set<string>> = { href: new Set(['http', 'https', 'mailto', 'tel']), src: new Set(['http', 'https']) };

/** Add, change (`string` or `true`) or remove (`null`) an attribute on a plain HTML element. */
export function setAttribute(ast: any, node: t.JSXElement, name: string | undefined, value: unknown) {
  const opening = node.openingElement;
  if (!name || !isEditableAttribute(name)) throw new Error(`UNSUPPORTED_OPERATION: ${name} is not an attribute the editor can set. Edit it in source.`);
  if (!t.isJSXIdentifier(opening.name) || !/^[a-z]/.test(opening.name.name)) {
    throw new Error('UNSUPPORTED_OPERATION: Components take props they declare; set this on an HTML element, or add the prop in source.');
  }
  if (opening.attributes.some(t.isJSXSpreadAttribute)) throw new Error('UNSUPPORTED_OPERATION: A spread may supply or override this attribute; edit it in source.');
  if (value !== null && value !== true && typeof value !== 'string') throw new Error('INVALID_PROP: An attribute value is text, true, or null to remove it.');
  // HTML attribute names ignore case, so a hand-written `popovertarget` is the same attribute as `popoverTarget`.
  const named = (key: string) => opening.attributes.filter((a): a is t.JSXAttribute => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name.toLowerCase() === key.toLowerCase());
  const existing = named(name);
  if (existing.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  if (existing[0] && literal(existing[0].value) === undefined) throw new Error('UNSUPPORTED_OPERATION: This attribute is computed; edit it in source.');
  if (typeof value === 'string') {
    // JSX decodes character references in attribute text, so `javascript&#58;` would run as `javascript:`.
    if (URL_SCHEMES[name] && /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(value)) {
      throw new Error(`INVALID_PROP: Character references are not allowed in ${name}; type the character itself.`);
    }
    // Browsers ignore whitespace and control characters inside a scheme, so `java\nscript:` is still script.
    const scheme = value.replace(/[\x00-\x20]/g, '').match(/^([a-z][a-z0-9+.-]*):/i)?.[1].toLowerCase();
    if (URL_SCHEMES[name] && scheme && !URL_SCHEMES[name].has(scheme)) throw new Error(`INVALID_PROP: ${scheme}: links are not allowed in ${name}.`);
    if (name === 'id') {
      if (!/^[A-Za-z][\w-]*$/.test(value)) throw new Error('INVALID_PROP: An id starts with a letter and uses letters, digits, - and _.');
      t.traverseFast(ast, item => {
        if (t.isJSXAttribute(item) && !existing.includes(item) && t.isJSXIdentifier(item.name, { name: 'id' }) && literal(item.value) === value) {
          throw new Error(`INVALID_PROP: The id "${value}" is already used in this file.`);
        }
      });
    }
  }
  const write = (key: string, next: string | true | null) => {
    const current = named(key)[0];
    if (next === null) { if (current) opening.attributes.splice(opening.attributes.indexOf(current), 1); return; }
    const node = next === true ? null : t.stringLiteral(next);
    if (current) { current.name = t.jsxIdentifier(key); current.value = node; } else opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(key), node));
  };
  write(name, value as string | true | null);
  // A new tab must not get a handle on this page.
  if (name === 'target' && value === '_blank') {
    if (named('rel').length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate rel attributes are ambiguous.');
    const rel = named('rel')[0], tokens = new Set(String(rel ? literal(rel.value) ?? '' : '').split(/\s+/).filter(Boolean));
    if (rel && literal(rel.value) === undefined) throw new Error('UNSUPPORTED_OPERATION: rel is computed; add noopener in source.');
    write('rel', [...new Set([...tokens, 'noopener', 'noreferrer'])].join(' '));
  }
}

export function mutateProp(ast: any, node: t.JSXElement, property: string | undefined, value: unknown, scope?: string) {
  const info = describe(ast, node);
  if (scope !== info.scope) throw new Error('INVALID_SCOPE: Confirm the authored call site or source element scope.');
  // HTML attributes go through the same checks whichever control edits them.
  if (info.scope === 'source-element' && property && isEditableAttribute(property)) {
    // Typed controls send booleans and numbers: `disabled={false}` means no attribute, other values become text.
    const text = value === false ? (property === 'disabled' ? null : 'false') : typeof value === 'number' ? String(value) : value;
    return setAttribute(ast, node, property, text);
  }
  const prop = info.props.find(item => item.name === property);
  if (!prop || prop.reason) throw new Error('UNSUPPORTED_OPERATION: ' + (prop?.reason || 'Only existing literal props are editable.'));
  if (prop.kind === 'enum' ? !prop.choices?.includes(value as Scalar) : typeof value !== prop.kind) throw new Error('INVALID_PROP: The value does not match the authored type.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('INVALID_PROP: Expected a finite number.');
  const attr = node.openingElement.attributes.find(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: property })) as t.JSXAttribute;
  // Expressions ensure Babel escapes quotes, braces and markup safely.
  attr.value = t.jsxExpressionContainer(t.valueToNode(value as Scalar) as t.Expression);
}
