import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = (traverseModule as any).default || traverseModule;

export function findJSXElementAt(
  sourceCode: string,
  line: number,
  column: number
): any {
  const ast = parse(sourceCode, {
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
    case 'paddingLeft': return name.startsWith('pl-');
    case 'paddingRight': return name.startsWith('pr-');
    case 'paddingTop': return name.startsWith('pt-');
    case 'paddingBottom': return name.startsWith('pb-');
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
      // Tailwind position utilities: static, relative, absolute, fixed, sticky
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
        case 'paddingLeft': prefix = 'pl-'; break;
        case 'paddingRight': prefix = 'pr-'; break;
        case 'paddingTop': prefix = 'pt-'; break;
        case 'paddingBottom': prefix = 'pb-'; break;
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
        if (['marginLeft','marginRight','marginTop','marginBottom','paddingLeft','paddingRight','paddingTop','paddingBottom'].includes(property)) {
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

      // JIT matches e.g. ml-[-16px] or ml-[16px]
      const jitMatch = name.match(/-\[([-\d]+)(?:px)?\]$/);
      if (jitMatch) {
        return Number(jitMatch[1]);
      }

      // Standard Tailwind matches e.g. ml-4
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
  breakpoint?: string
): string {
  const node = findJSXElementAt(sourceCode, line, column);
  if (!node) {
    throw new Error(`JSX element not found at line ${line}, column ${column}`);
  }

  // Find className attribute
  const classAttr = node.attributes.find(
    (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'className'
  );

  if (classAttr) {
    // Modify existing className
    if (!classAttr.value || classAttr.value.type !== 'StringLiteral') {
      throw new Error(`className attribute value is not a string literal`);
    }

    const start = classAttr.value.start;
    const end = classAttr.value.end;
    const existingVal = classAttr.value.value;

    const newVal = updateClassString(existingVal, property, value, breakpoint);

    return sourceCode.slice(0, start) + `"${newVal}"` + sourceCode.slice(end);
  } else {
    // Inject new className attribute
    const insertIndex = node.name.end;
    const newVal = updateClassString('', property, value, breakpoint);

    return (
      sourceCode.slice(0, insertIndex) +
      ` className="${newVal}"` +
      sourceCode.slice(insertIndex)
    );
  }
}

export function updateJSXText(
  sourceCode: string,
  line: number,
  column: number,
  newText: string
): string {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetNode: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetNode = path.node;
        path.stop();
      }
    },
  });

  if (!targetNode) {
    throw new Error(`JSX element not found at line ${line}, column ${column}`);
  }

  // Find the first JSXText child and replace just its content
  const children: any[] = targetNode.children || [];
  
  const textChild = children.find((c: any) => c.type === 'JSXText');
  
  if (textChild && textChild.start != null && textChild.end != null) {
    // Preserve surrounding whitespace/indentation inside the element
    const existingRaw = sourceCode.slice(textChild.start, textChild.end);
    const leadingWs = existingRaw.match(/^(\s*)/)?.[1] ?? '';
    const trailingWs = existingRaw.match(/(\s*)$/)?.[1] ?? '';
    const replacement = leadingWs + newText + trailingWs;
    return sourceCode.slice(0, textChild.start) + replacement + sourceCode.slice(textChild.end);
  }

  // No existing text child — insert text between opening and closing tags
  const openEnd = targetNode.openingElement.end;
  const closeStart = targetNode.closingElement
    ? targetNode.closingElement.start
    : openEnd;

  if (openEnd == null || closeStart == null) {
    throw new Error('Cannot determine insertion point for text.');
  }

  return (
    sourceCode.slice(0, openEnd) +
    newText +
    sourceCode.slice(closeStart)
  );
}

/**
 * Sets or merges CSS properties into the JSX `style` prop of an element.
 * Framework-agnostic — works without Tailwind.
 *
 * Before: <div className="foo">
 * After:  <div className="foo" style={{position:'relative',left:'200px',top:'100px'}}>
 *
 * If a style prop already exists, keys are merged (unknown keys are preserved).
 */
export function updateJSXStyleProp(
  sourceCode: string,
  line: number,
  column: number,
  styles: Record<string, string>
): string {
  const node = findJSXElementAt(sourceCode, line, column);
  if (!node) {
    throw new Error(`JSX element not found at line ${line}, column ${column}`);
  }

  // Find existing style attribute
  const styleAttr = node.attributes.find(
    (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === 'style'
  );

  if (styleAttr) {
    // Parse existing key:value pairs (handles both single and double quotes)
    const existingRaw = sourceCode.slice(styleAttr.start, styleAttr.end);
    const existing: Record<string, string> = {};
    const kvRe = /(\w+)\s*:\s*['"]([^'"]*)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = kvRe.exec(existingRaw)) !== null) {
      existing[m[1]] = m[2];
    }
    // Merge — new styles overwrite matching keys
    const merged = { ...existing, ...styles };
    const styleStr = Object.entries(merged)
      .map(([k, v]) => `${k}:'${v}'`)
      .join(',');
    return (
      sourceCode.slice(0, styleAttr.start) +
      `style={{${styleStr}}}` +
      sourceCode.slice(styleAttr.end)
    );
  } else {
    // Inject new style prop right after the element name
    const styleStr = Object.entries(styles)
      .map(([k, v]) => `${k}:'${v}'`)
      .join(',');
    const insertIndex = node.name.end;
    return (
      sourceCode.slice(0, insertIndex) +
      ` style={{${styleStr}}}` +
      sourceCode.slice(insertIndex)
    );
  }
}
