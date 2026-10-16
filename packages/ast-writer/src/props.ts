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
    if (/^(on[A-Z]|data-gl-)/.test(prop.name) || ['key', 'ref', 'id', 'style', 'className', 'dangerouslySetInnerHTML', 'children'].includes(prop.name)) {
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

export function mutateProp(ast: any, node: t.JSXElement, property: string | undefined, value: unknown, scope?: string) {
  const info = describe(ast, node);
  if (scope !== info.scope) throw new Error('INVALID_SCOPE: Confirm the authored call site or source element scope.');
  const prop = info.props.find(item => item.name === property);
  if (!prop || prop.reason) throw new Error('UNSUPPORTED_OPERATION: ' + (prop?.reason || 'Only existing literal props are editable.'));
  if (prop.kind === 'enum' ? !prop.choices?.includes(value as Scalar) : typeof value !== prop.kind) throw new Error('INVALID_PROP: The value does not match the authored type.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('INVALID_PROP: Expected a finite number.');
  const attr = node.openingElement.attributes.find(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: property })) as t.JSXAttribute;
  // Expressions ensure Babel escapes quotes, braces and markup safely.
  attr.value = t.jsxExpressionContainer(t.valueToNode(value as Scalar) as t.Expression);
}
