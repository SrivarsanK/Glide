/**
 * Class lists inside a className expression: string arguments of cn/clsx-style
 * helpers, template literal text, and same-file cva definitions. Each piece
 * records whether it applies only under a runtime condition.
 */

import * as t from '@babel/types';
import _generate from '@babel/generator';

const generate = (_generate as any).default || _generate;
const CLASS_HELPERS = new Set(['cn', 'clsx', 'cx', 'classnames', 'classNames', 'twMerge', 'twJoin']);

/** The scope of the edited element, used to find cva definitions. */
export interface BindingScope { getBinding(name: string): any }

export interface ClassToken {
  name: string;
  /** The class continues into an interpolation, so only part of it is static. */
  partial: boolean;
  /** For a partial class that starts in static text, that static start (`bg-` in `bg-${tone}`). */
  prefix?: string;
}

export interface ClassPiece {
  tokens: ClassToken[];
  /** When the piece applies, such as "when `active`" or "by the `size` variant". */
  condition?: string;
  /** Part of a cva definition rather than this element's own expression. */
  shared: boolean;
  /** A cva definition other code also uses, so its classes cannot change for one element. */
  lockedBy?: string;
  /** The cva variant option the piece belongs to, such as `size: "lg"`. */
  variant?: VariantOption;
  /** Whether a new class can be written into this piece. */
  canAdd: boolean;
  /** Drop the classes `keep` rejects. `add` takes the first dropped class's place, or joins the piece. */
  rewrite(keep: (name: string) => boolean, add?: string): void;
}

export interface VariantOption { group: string; option: string }

export interface ClassExpression {
  pieces: ClassPiece[];
  /** Puts a class string before the other arguments of the outermost helper call. */
  prepend?: (classes: string) => void;
}

const source = (node: t.Node): string => {
  const code: string = generate(node).code.replace(/\s+/g, ' ');
  return code.length > 40 ? code.slice(0, 39) + '…' : code;
};

/** Rewrite whitespace-separated classes in place, keeping the surrounding whitespace. */
function rewriteText(text: string, keep: (name: string, index: number) => boolean, add?: string): { text: string; placed: boolean } {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let placed = !add, index = 0;
  const lastIsSpace = () => out.length > 0 && /^\s+$/.test(out[out.length - 1]);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Keep leading whitespace and one gap between kept classes.
      if ((i === 1 && parts[0] === '') || (out.length && !lastIsSpace())) out.push(part);
      return;
    }
    if (!part) return;
    if (keep(part, index++)) out.push(part);
    else if (!placed) { out.push(add!); placed = true; }
  });
  if (!/\s$/.test(text) && lastIsSpace()) out.pop();
  return { text: out.join(''), placed };
}

function tokensOf(text: string, startsInExpression: boolean, endsInExpression: boolean): ClassToken[] {
  const names = text.split(/\s+/).filter(Boolean);
  const startPartial = startsInExpression && !/^\s/.test(text);
  const endPartial = endsInExpression && !/\s$/.test(text);
  return names.map((name, index) => {
    const first = index === 0 && startPartial, last = index === names.length - 1 && endPartial;
    return { name, partial: first || last, ...(last && !first ? { prefix: name } : {}) };
  });
}

/** Change a string's value. Its original raw text stays, so the printer can match the original quotes. */
function setString(node: t.StringLiteral, value: string): void {
  node.value = value;
}

/** Where a piece sits: under a condition, inside a cva definition, or in one that other code uses. */
interface Origin { condition?: string; shared: boolean; lockedBy?: string; variant?: VariantOption }

function literalPiece(node: t.StringLiteral, origin: Origin, list?: any[]): ClassPiece {
  return {
    tokens: tokensOf(node.value, false, false), ...origin, canAdd: true,
    rewrite(keep, add) {
      let { text, placed } = rewriteText(node.value, keep, add);
      if (!placed) text = text.trim() ? text.replace(/(\s*)$/, ` ${add}$1`) : add!;
      if (text === node.value) return;
      // An emptied argument of a helper call or array has no effect; remove it.
      if (!text.trim() && list && list.includes(node)) list.splice(list.indexOf(node), 1);
      else setString(node, text);
    },
  };
}

function quasiPiece(template: t.TemplateLiteral, index: number, origin: Origin): ClassPiece {
  const quasi = template.quasis[index];
  const first = index === 0, last = index === template.quasis.length - 1;
  const text = () => quasi.value.cooked ?? quasi.value.raw;
  return {
    tokens: tokensOf(text(), !first, !last), ...origin, canAdd: first,
    rewrite(keep, add) {
      const tokens = tokensOf(text(), !first, !last);
      let { text: next, placed } = rewriteText(text(), (name, i) => tokens[i].partial || keep(name), add);
      if (!placed) next = add + (next === '' ? (last ? '' : ' ') : /^\s/.test(next) ? '' : ' ') + next;
      if (next === text()) return;
      quasi.value = { cooked: next, raw: next.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') };
    },
  };
}

/** The `cva(base, config)` call a same-file constant is bound to, and whether other code also uses it. */
export function cvaDefinition(name: string, scope?: BindingScope): { call: t.CallExpression; usedElsewhere: boolean } | null {
  const binding = scope?.getBinding(name);
  const node = binding?.constant ? binding.path?.node : null;
  if (!t.isVariableDeclarator(node) || !t.isCallExpression(node.init) || !t.isIdentifier(node.init.callee, { name: 'cva' })) return null;
  // `VariantProps<typeof buttonVariants>` names the type only; every other reference, export included, uses the classes.
  const uses = (binding.referencePaths ?? []).filter((ref: any) => !ref.parentPath?.isTSTypeQuery());
  const exported = !!binding.path.parentPath?.parentPath?.isExportNamedDeclaration();
  return { call: node.init, usedElsewhere: exported || uses.length !== 1 };
}

export function propertyName(prop: t.ObjectProperty): string | null {
  if (prop.computed) return null;
  return t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null;
}

/** Read the class lists of a className expression. Unreadable parts, such as `className`, are skipped. */
export function readClassExpression(expression: t.Expression, scope?: BindingScope): ClassExpression {
  const result: ClassExpression = { pieces: [] };
  const seen = new Set<t.Node>();

  const visitCva = ({ call, usedElsewhere }: { call: t.CallExpression; usedElsewhere: boolean }, name: string,
    condition: string | undefined) => {
    if (seen.has(call)) return;
    seen.add(call);
    const at = (when?: string, variant?: VariantOption): Origin => ({ condition: when, shared: true,
      ...(usedElsewhere ? { lockedBy: name } : {}), ...(variant ? { variant } : {}) });
    const [base, config] = call.arguments;
    if (base) visit(base, at(condition));
    if (!t.isObjectExpression(config)) return;
    for (const prop of config.properties) {
      if (!t.isObjectProperty(prop)) continue;
      const key = propertyName(prop);
      if (key === 'variants' && t.isObjectExpression(prop.value)) {
        for (const group of prop.value.properties) {
          if (!t.isObjectProperty(group) || !t.isObjectExpression(group.value)) continue;
          const groupName = propertyName(group) ?? source(group.key);
          const label = condition ?? `by the \`${groupName}\` variant`;
          for (const option of group.value.properties) {
            const optionName = t.isObjectProperty(option) ? propertyName(option) : null;
            if (t.isObjectProperty(option)) {
              visit(option.value, at(label, optionName === null ? undefined : { group: groupName, option: optionName }));
            }
          }
        }
      } else if (key === 'compoundVariants' && t.isArrayExpression(prop.value)) {
        for (const entry of prop.value.elements) {
          if (!t.isObjectExpression(entry)) continue;
          for (const field of entry.properties) {
            if (t.isObjectProperty(field) && ['class', 'className'].includes(propertyName(field) ?? '')) {
              visit(field.value, at(condition ?? 'by a compound variant'));
            }
          }
        }
      }
    }
  };

  const visit = (node: t.Node | null | undefined, origin: Origin, list?: any[]): void => {
    while (t.isTSAsExpression(node) || t.isTSNonNullExpression(node) || t.isParenthesizedExpression(node)) node = node.expression;
    if (!node) return;
    const when = (test: t.Node): Origin => ({ ...origin, condition: origin.condition ?? `when \`${source(test)}\`` });
    if (t.isStringLiteral(node)) {
      result.pieces.push(literalPiece(node, origin, list));
    } else if (t.isTemplateLiteral(node)) {
      node.quasis.forEach((_, index) => result.pieces.push(quasiPiece(node as t.TemplateLiteral, index, origin)));
      node.expressions.forEach(inner => visit(inner, origin));
    } else if (t.isCallExpression(node) && t.isIdentifier(node.callee) && CLASS_HELPERS.has(node.callee.name)) {
      const args = node.arguments;
      if (!origin.condition && !origin.shared && !result.prepend) {
        result.prepend = classes => { args.unshift(t.stringLiteral(classes)); };
      }
      args.forEach(arg => visit(arg, origin, args));
    } else if (t.isArrayExpression(node)) {
      node.elements.forEach(element => visit(element, origin, node.elements as any[]));
    } else if (t.isLogicalExpression(node)) {
      if (node.operator !== '&&') visit(node.left, when(node.left));
      visit(node.right, when(node.left));
    } else if (t.isConditionalExpression(node)) {
      visit(node.consequent, when(node.test));
      visit(node.alternate, when(node.test));
    } else if (t.isObjectExpression(node)) {
      // clsx objects: { "bg-red-500": hasError }
      for (const prop of node.properties) {
        if (t.isObjectProperty(prop) && !prop.computed && t.isStringLiteral(prop.key)) {
          result.pieces.push(literalPiece(prop.key, when(prop.value)));
        }
      }
    } else if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
      const definition = cvaDefinition(node.callee.name, scope);
      if (definition) visitCva(definition, node.callee.name, origin.condition);
    }
  };

  visit(expression, { shared: false });
  return result;
}
