/**
 * Facts the editor needs to offer edit scopes for a component instance: whether
 * an element passes its component's className through, and which cva variant
 * options it renders with.
 */

import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { cvaDefinition, propertyName, readClassExpression, type BindingScope, type VariantOption } from './class-expression.js';
import { restWithout } from './writer.js';

const traverse = (traverseModule as any).default || traverseModule;

function elementAt(source: string, line: number, column: number): any {
  const ast = babelParse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  let found: any = null;
  traverse(ast, { JSXElement(path: any) {
    const start = path.node.loc?.start;
    if (start?.line === line && start.column === column - 1) { found = path; path.stop(); }
  } });
  if (!found) throw new Error(`NODE_NOT_FOUND: No JSX element exists at ${line}:${column}.`);
  return found;
}

/** A binding that holds the component's props or part of them: a parameter, or a value read from one. */
function fromProps(scope: BindingScope, name: string): boolean {
  const binding = scope.getBinding(name);
  if (!binding) return false;
  if (binding.kind === 'param') return true;
  const node = binding.path?.node;
  return t.isVariableDeclarator(node) && t.isIdentifier(node.init) && scope.getBinding(node.init.name)?.kind === 'param';
}

/**
 * Whether the element at line:column applies the className its component receives,
 * as `cn(base, className)`, `props.className` or a `{...props}` spread do. A class
 * added where the component is used only reaches the element when this holds.
 */
export function forwardsClassName(source: string, line: number, column: number): boolean {
  const element = elementAt(source, line, column);
  const attributes: any[] = element.get('openingElement.attributes');
  const index = attributes.findIndex(attr => attr.isJSXAttribute() && t.isJSXIdentifier(attr.node.name, { name: 'className' }));
  let uses = false;
  if (index >= 0) {
    attributes[index].traverse({
      ReferencedIdentifier(path: any) {
        if (path.node.name === 'className' && fromProps(path.scope, 'className')) { uses = true; path.stop(); }
      },
      MemberExpression(path: any) {
        const { object, property, computed } = path.node;
        if (!computed && t.isIdentifier(property, { name: 'className' }) && t.isIdentifier(object) && fromProps(path.scope, object.name)) {
          uses = true; path.stop();
        }
      },
    });
  }
  // A spread after the attribute (or anywhere, without one) passes className on unless it was taken out.
  const spreads = attributes.slice(index + 1).filter(attr => attr.isJSXSpreadAttribute());
  return uses || spreads.some(spread => t.isIdentifier(spread.node.argument)
    && fromProps(spread.scope, spread.node.argument.name) && !restWithout(spread.node, 'className', spread.scope));
}

export interface ActiveVariant extends VariantOption {
  /** The cva definition, such as `buttonVariants`. */
  definition: string;
  /** Other code uses the definition too, so the option changes there as well. */
  shared: boolean;
}

/**
 * The cva variant options the element at line:column renders with, from the props
 * its component received and the definition's defaultVariants.
 */
export function activeVariants(source: string, line: number, column: number, props: Record<string, unknown>): ActiveVariant[] {
  const element = elementAt(source, line, column);
  const attribute = element.node.openingElement.attributes.find((attr: any) =>
    t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'className' }));
  if (!t.isJSXExpressionContainer(attribute?.value) || t.isJSXEmptyExpression(attribute.value.expression)) return [];
  const result: ActiveVariant[] = [];
  const seen = new Set<t.Node>();
  const visit = (node: t.Node) => {
    if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
      const definition = cvaDefinition(node.callee.name, element.scope);
      if (definition && !seen.has(definition.call)) {
        seen.add(definition.call);
        result.push(...optionsOf(definition.call, props).map(option => ({
          ...option, definition: (node.callee as t.Identifier).name, shared: definition.usedElsewhere })));
      }
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as any)[key];
      for (const item of Array.isArray(child) ? child : [child]) if (item && typeof item.type === 'string') visit(item);
    }
  };
  visit(attribute.value.expression);
  // Only options that hold a class string can be edited.
  const editable = readClassExpression(attribute.value.expression, element.scope).pieces;
  return result.filter(option => editable.some(piece => piece.variant?.group === option.group && piece.variant.option === option.option));
}

function optionsOf(call: t.CallExpression, props: Record<string, unknown>): VariantOption[] {
  const config = call.arguments[1];
  if (!t.isObjectExpression(config)) return [];
  const field = (name: string) => config.properties.find((prop): prop is t.ObjectProperty =>
    t.isObjectProperty(prop) && propertyName(prop) === name)?.value;
  const variants = field('variants'), defaults = field('defaultVariants');
  if (!t.isObjectExpression(variants)) return [];
  const options: VariantOption[] = [];
  for (const group of variants.properties) {
    const name = t.isObjectProperty(group) ? propertyName(group) : null;
    if (!name || !t.isObjectExpression((group as t.ObjectProperty).value)) continue;
    let value: unknown = props[name];
    if (value === undefined && t.isObjectExpression(defaults)) {
      const fallback = defaults.properties.find((prop): prop is t.ObjectProperty => t.isObjectProperty(prop) && propertyName(prop) === name)?.value;
      if (t.isStringLiteral(fallback) || t.isNumericLiteral(fallback) || t.isBooleanLiteral(fallback)) value = fallback.value;
    }
    if (value !== undefined && ['string', 'number', 'boolean'].includes(typeof value)) options.push({ group: name, option: String(value) });
  }
  return options;
}
