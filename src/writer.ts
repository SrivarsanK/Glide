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

export function updateClassString(
  existingClasses: string,
  property: string,
  value: any,
  breakpoint?: string
): string {
  const classes = existingClasses.split(/\s+/).filter(Boolean);

  if (property === 'className') {
    return value;
  }

  const newClass = getNewClass(property, value);
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
      // If it doesn't have a breakpoint prefix, check if it matches the property
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
