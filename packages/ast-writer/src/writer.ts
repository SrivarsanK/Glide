import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import * as crypto from 'crypto';
import ts from 'typescript';
import { parse as recastParse, print as recastPrint } from 'recast';
import * as babelParser from 'recast/parsers/babel.js';

const traverse = (traverseModule as any).default || traverseModule;
const generate = (_generate as any).default || _generate;


export function computeNodeHash(sourceCodeSlice: string): string {
  return crypto.createHash('sha1').update(sourceCodeSlice.trim()).digest('hex').substring(0, 8);
}

function validateTypeScript(code: string) {
  const result = ts.createSourceFile('temp.tsx', code, ts.ScriptTarget.Latest, true);
  const diagnostics = (result as any).parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    const msg = diagnostics[0].messageText;
    throw new Error(`TypeScript syntax validation failed: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
}

export function findJSXElementAt(
  sourceCode: string,
  line: number,
  column: number
): any {
  const ast = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetNode: any = null;

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const loc = path.node.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetNode = path.node;
        path.stop();
      }
    },
  });

  return targetNode;
}

function matchesProperty(c: string, property: string): boolean {
  const parts = c.split(':');
  const name = parts[parts.length - 1];

  switch (property) {
    case 'marginLeft': return name.startsWith('ml-');
    case 'marginRight': return name.startsWith('mr-');
    case 'marginTop': return name.startsWith('mt-');
    case 'marginBottom': return name.startsWith('mb-');
    case 'margin': return name.split('-')[0] === 'm';
    case 'paddingLeft': return name.startsWith('pl-');
    case 'paddingRight': return name.startsWith('pr-');
    case 'paddingTop': return name.startsWith('pt-');
    case 'paddingBottom': return name.startsWith('pb-');
    case 'padding': return name.split('-')[0] === 'p';
    case 'width': return name.startsWith('w-');
    case 'height': return name.startsWith('h-');
    case 'gap': return name.startsWith('gap-') && !name.startsWith('gap-y') && !name.startsWith('gap-x');
    case 'rowGap': return name.startsWith('gap-y-');
    case 'opacity': return name.startsWith('opacity-');
    case 'borderTopLeftRadius': return name.startsWith('rounded-tl');
    case 'borderTopRightRadius': return name.startsWith('rounded-tr');
    case 'borderBottomRightRadius': return name.startsWith('rounded-br');
    case 'borderBottomLeftRadius': return name.startsWith('rounded-bl');
    case 'flexDirection': return name === 'flex-row' || name === 'flex-col';
    case 'justifyContent': return name.startsWith('justify-');
    case 'alignItems': return name.startsWith('items-');
    case 'borderStyle': return ['border-solid', 'border-dashed', 'border-dotted', 'border-none'].includes(name);
    case 'fontSize':
      return name.startsWith('text-') && !matchesProperty(c, 'color') && !matchesProperty(c, 'textAlign');
    case 'textAlign':
      return ['text-left', 'text-center', 'text-right', 'text-justify'].includes(name);
    case 'color':
      return name.startsWith('text-') && !['left', 'center', 'right', 'justify'].includes(name.slice(5)) && !/^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|\[\d+(px|rem|em)\])$/.test(name.slice(5));
    case 'backgroundColor':
      return name.startsWith('bg-');
    case 'borderColor':
      return name.startsWith('border-') && !matchesProperty(c, 'borderWidth') && !matchesProperty(c, 'borderStyle');
    case 'borderWidth':
      return name.startsWith('border-') && (/^border-\[\d+px\]$/.test(name) || /^border-\d+$/.test(name) || name === 'border');
    case 'position': return ['static','relative','absolute','fixed','sticky'].includes(name);
    case 'left': return name.startsWith('left-');
    case 'top': return name.startsWith('top-');
    case 'right': return name.startsWith('right-');
    case 'bottom': return name.startsWith('bottom-');
    default:
      return false;
  }
}

function getNewClass(property: string, value: any): string {
  const clean = String(value).trim().replace(/^["']|["']$/g, '');

  switch (property) {
    case 'flexDirection':
      return clean === 'column' ? 'flex-col' : 'flex-row';
    case 'justifyContent':
      return `justify-${clean}`;
    case 'alignItems':
      return `items-${clean}`;
    case 'textAlign':
      return `text-${clean}`;
    case 'borderStyle':
      return `border-${clean}`;
    case 'position':
      return ['static','relative','absolute','fixed','sticky'].includes(clean) ? clean : 'relative';
    case 'left': {
      let v = clean;
      if (/^-?\d+px$/.test(v)) v = v.slice(0, -2);
      return `left-[${v}px]`;
    }
    case 'top': {
      let v = clean;
      if (/^-?\d+px$/.test(v)) v = v.slice(0, -2);
      return `top-[${v}px]`;
    }
    case 'right': {
      let v = clean;
      if (/^-?\d+px$/.test(v)) v = v.slice(0, -2);
      return `right-[${v}px]`;
    }
    case 'bottom': {
      let v = clean;
      if (/^-?\d+px$/.test(v)) v = v.slice(0, -2);
      return `bottom-[${v}px]`;
    }
    default:
      let prefix = '';
      switch (property) {
        case 'marginLeft': prefix = 'ml-'; break;
        case 'marginRight': prefix = 'mr-'; break;
        case 'marginTop': prefix = 'mt-'; break;
        case 'marginBottom': prefix = 'mb-'; break;
        case 'margin': prefix = 'm-'; break;
        case 'paddingLeft': prefix = 'pl-'; break;
        case 'paddingRight': prefix = 'pr-'; break;
        case 'paddingTop': prefix = 'pt-'; break;
        case 'paddingBottom': prefix = 'pb-'; break;
        case 'padding': prefix = 'p-'; break;
        case 'width': prefix = 'w-'; break;
        case 'height': prefix = 'h-'; break;
        case 'gap': prefix = 'gap-'; break;
        case 'rowGap': prefix = 'gap-y-'; break;
        case 'opacity': prefix = 'opacity-'; break;
        case 'borderTopLeftRadius': prefix = 'rounded-tl-'; break;
        case 'borderTopRightRadius': prefix = 'rounded-tr-'; break;
        case 'borderBottomRightRadius': prefix = 'rounded-br-'; break;
        case 'borderBottomLeftRadius': prefix = 'rounded-bl-'; break;
        case 'fontSize': prefix = 'text-'; break;
        case 'color': prefix = 'text-'; break;
        case 'backgroundColor': prefix = 'bg-'; break;
        case 'borderColor': prefix = 'border-'; break;
        case 'borderWidth': prefix = 'border-'; break;
      }
      if (prefix) {
        let val = clean;
        if (/^\d+px$/.test(clean)) {
          val = clean.slice(0, -2);
        }

        // Check for standard multiples of 4 for margins/paddings
        if (['marginLeft','marginRight','marginTop','marginBottom','margin','paddingLeft','paddingRight','paddingTop','paddingBottom','padding'].includes(property)) {
          const num = Number(val);
          if (!isNaN(num) && num % 4 === 0 && num > 0 && num <= 384) {
            return `${prefix}${num / 4}`;
          }
        }

        if (property === 'color' || property === 'backgroundColor' || property === 'borderColor') {
          return `${prefix}[${val}]`;
        }
        if (property === 'opacity') {
          return `${prefix}[${val}]`;
        }
        if (/^\d+$/.test(val)) {
          return `${prefix}[${val}px]`;
        }
        return `${prefix}[${val}]`;
      }
      return '';
  }
}

function getExistingValue(existingClasses: string, property: string): number {
  const classes = existingClasses.split(/\s+/).filter(Boolean);
  for (const c of classes) {
    if (matchesProperty(c, property)) {
      const parts = c.split(':');
      const name = parts[parts.length - 1];

      const jitMatch = name.match(/-\[([-\d]+)(?:px)?\]$/);
      if (jitMatch) {
        return Number(jitMatch[1]);
      }

      let prefix = '';
      if (property.startsWith('margin') || property.startsWith('padding')) {
        const char = property.includes('Left') ? 'l' : property.includes('Right') ? 'r' : property.includes('Top') ? 't' : 'b';
        prefix = property.startsWith('margin') ? `m${char}-` : `p${char}-`;
      }
      if (prefix && name.startsWith(prefix)) {
        const valStr = name.slice(prefix.length);
        const val = Number(valStr);
        if (!isNaN(val)) {
          return val * 4;
        }
      }
    }
  }
  return 0;
}

export function updateClassString(
  existingClasses: string,
  property: string,
  value: any,
  breakpoint?: string
): string {
  if (property === 'className') {
    return value;
  }

  let finalValue = value;
  const valStr = String(value).trim();
  if (valStr.startsWith('+=') || valStr.startsWith('-=')) {
    const isNegative = valStr.startsWith('-=');
    const change = Number(valStr.slice(2).replace('px', ''));
    if (!isNaN(change)) {
      const current = getExistingValue(existingClasses, property);
      finalValue = isNegative ? (current - change) : (current + change);
    }
  }

  const classes = existingClasses.split(/\s+/).filter(Boolean);
  const newClass = getNewClass(property, finalValue);
  if (!newClass) return existingClasses;

  if (breakpoint) {
    const breakpointNewClass = `${breakpoint}:${newClass}`;
    const filtered = classes.filter(c => {
      const parts = c.split(':');
      if (parts.length > 1 && parts[0] === breakpoint) {
        return !matchesProperty(c, property);
      }
      return true;
    });
    filtered.push(breakpointNewClass);
    return filtered.join(' ');
  } else {
    const filtered = classes.filter(c => {
      const parts = c.split(':');
      if (parts.length === 1) {
        return !matchesProperty(c, property);
      }
      return true;
    });
    filtered.push(newClass);
    return filtered.join(' ');
  }
}

export function updateClassName(
  sourceCode: string,
  line: number,
  column: number,
  property: string,
  value: any,
  breakpoint?: string,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: babelParser });

  let targetPath: any = null;
  traverse(ast, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetPath = path;
        path.stop();
      }
    },
  });

  const openingEl = targetPath.node.openingElement;
  let classAttr = openingEl.attributes.find(
    (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'className'
  );

  let existingVal = '';
  if (classAttr) {
    if (classAttr.value && classAttr.value.type === 'StringLiteral') {
      existingVal = classAttr.value.value;
    }
  }

  const newVal = updateClassString(existingVal, property, value, breakpoint);

  // 1. Gather all nodes to update: target node + any nodes with matching className
  const nodesToUpdate: Array<{ node: any; path: any }> = [];
  nodesToUpdate.push({ node: targetPath.node, path: targetPath });

  if (existingVal) {
    traverse(ast, {
      JSXElement(path: any) {
        if (path.node === targetPath.node) return;
        const nodeOpeningEl = path.node.openingElement;
        const nodeClassAttr = nodeOpeningEl.attributes.find(
          (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'className'
        );
        if (nodeClassAttr && nodeClassAttr.value && nodeClassAttr.value.type === 'StringLiteral') {
          if (nodeClassAttr.value.value === existingVal) {
            nodesToUpdate.push({ node: path.node, path: path });
          }
        }
      }
    });
  }

  // 2. Apply changes
  for (const { node } of nodesToUpdate) {
    const itemOpeningEl = node.openingElement;
    let itemClassAttr = itemOpeningEl.attributes.find(
      (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'className'
    );
    if (itemClassAttr) {
      itemClassAttr.value = t.stringLiteral(newVal);
    } else {
      itemOpeningEl.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier('className'),
          t.stringLiteral(newVal)
        )
      );
    }
  }

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(targetPath.node).code;
  const confirmAst = recastParse(newJSXCode, { parser: babelParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXOpeningElement(path: any) {
      const attr = path.node.attributes.find(
        (a: any) => a.type === 'JSXAttribute' && a.name.name === 'className'
      );
      if (attr && attr.value && attr.value.type === 'StringLiteral' && attr.value.value === newVal) {
        hasExpectedValue = true;
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target node attribute was not updated as expected.');
  }

  return updatedSourceCode;
}

export function updateJSXText(
  sourceCode: string,
  line: number,
  column: number,
  newText: string,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: babelParser });

  let targetPath: any = null;
  traverse(ast, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetPath = path;
        path.stop();
      }
    },
  });

  const children: any[] = targetPath.node.children || [];
  const textChildIdx = children.findIndex((c: any) => c.type === 'JSXText');
  if (textChildIdx !== -1) {
    const existingRaw = children[textChildIdx].value;
    const leadingWs = existingRaw.match(/^(\s*)/)?.[1] ?? '';
    const trailingWs = existingRaw.match(/(\s*)$/)?.[1] ?? '';
    children[textChildIdx] = t.jsxText(leadingWs + newText + trailingWs);
  } else {
    targetPath.node.children = [t.jsxText(newText)];
  }

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(targetPath.node).code;
  const confirmAst = recastParse(newJSXCode, { parser: babelParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXText(path: any) {
      if (path.node.value.trim() === newText.trim()) {
        hasExpectedValue = true;
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target text content was not updated as expected.');
  }

  return updatedSourceCode;
}

export function updateJSXStyleProp(
  sourceCode: string,
  line: number,
  column: number,
  styles: Record<string, string>,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: babelParser });

  let targetPath: any = null;
  traverse(ast, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetPath = path;
        path.stop();
      }
    },
  });

  const openingEl = targetPath.node.openingElement;
  let styleAttr = openingEl.attributes.find(
    (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'style'
  );

  const newProperties = Object.entries(styles).map(([key, val]) => {
    return t.objectProperty(t.identifier(key), t.stringLiteral(val));
  });

  if (styleAttr) {
    if (styleAttr.value && styleAttr.value.type === 'JSXExpressionContainer' && styleAttr.value.expression.type === 'ObjectExpression') {
      const existingProperties = styleAttr.value.expression.properties as any[];
      const mergedProperties = [...existingProperties];
      newProperties.forEach(newProp => {
        const keyName = (newProp.key as any).name;
        const idx = mergedProperties.findIndex(p => p.type === 'ObjectProperty' && (p.key as any).name === keyName);
        if (idx !== -1) {
          mergedProperties[idx] = newProp;
        } else {
          mergedProperties.push(newProp);
        }
      });
      styleAttr.value.expression.properties = mergedProperties;
    } else {
      styleAttr.value = t.jsxExpressionContainer(t.objectExpression(newProperties));
    }
  } else {
    openingEl.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(t.objectExpression(newProperties))
      )
    );
  }

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(targetPath.node).code;
  const confirmAst = recastParse(newJSXCode, { parser: babelParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXAttribute(path: any) {
      if (path.node.name.name === 'style' && path.node.value.type === 'JSXExpressionContainer' && path.node.value.expression.type === 'ObjectExpression') {
        hasExpectedValue = true;
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target style prop was not updated as expected.');
  }

  return updatedSourceCode;
}
