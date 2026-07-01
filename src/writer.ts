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

export function updateClassString(
  existingClasses: string,
  property: string,
  value: any,
  breakpoint?: string
): string {
  const classes = existingClasses.split(/\s+/).filter(Boolean);
  let prefix = '';
  let newClass = '';

  if (property === 'className') {
    return value;
  }

  const mapping: Record<string, { prefix: string; scale: (val: any) => string }> = {
    marginLeft: { prefix: 'ml-', scale: (v) => `ml-${Math.round(Number(v) / 4)}` },
    marginRight: { prefix: 'mr-', scale: (v) => `mr-${Math.round(Number(v) / 4)}` },
    marginTop: { prefix: 'mt-', scale: (v) => `mt-${Math.round(Number(v) / 4)}` },
    marginBottom: { prefix: 'mb-', scale: (v) => `mb-${Math.round(Number(v) / 4)}` },
    paddingLeft: { prefix: 'pl-', scale: (v) => `pl-${Math.round(Number(v) / 4)}` },
    paddingRight: { prefix: 'pr-', scale: (v) => `pr-${Math.round(Number(v) / 4)}` },
    paddingTop: { prefix: 'pt-', scale: (v) => `pt-${Math.round(Number(v) / 4)}` },
    paddingBottom: { prefix: 'pb-', scale: (v) => `pb-${Math.round(Number(v) / 4)}` },
  };

  if (mapping[property]) {
    const config = mapping[property];
    prefix = config.prefix;
    newClass = config.scale(value);
  }

  if (prefix && newClass) {
    if (breakpoint) {
      const breakpointPrefix = `${breakpoint}:${prefix}`;
      const breakpointNewClass = `${breakpoint}:${newClass}`;
      const filtered = classes.filter(c => !c.startsWith(breakpointPrefix));
      filtered.push(breakpointNewClass);
      return filtered.join(' ');
    } else {
      const filtered = classes.filter(c => {
        const hasColon = c.indexOf(':') !== -1;
        return !(c.startsWith(prefix) && !hasColon);
      });
      filtered.push(newClass);
      return filtered.join(' ');
    }
  }

  return existingClasses;
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
