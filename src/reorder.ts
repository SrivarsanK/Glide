import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

export function reorderJSXElement(
  code: string,
  targetId: string,
  parentId: string,
  siblingId: string | null,
  position: 'before' | 'after'
): string {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetPath: any = null;
  let oldParentPath: any = null;
  let newParentPath: any = null;
  let siblingPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const openingEl = path.node.openingElement;
      let currentId = '';
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-cf-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            currentId = attr.value.value;
          }
        }
      });

      if (currentId === targetId) {
        targetPath = path;
      }
      if (currentId === parentId) {
        newParentPath = path;
      }
      if (siblingId && currentId === siblingId) {
        siblingPath = path;
      }
    },
  });

  if (!targetPath) {
    throw new Error(`Target element with id "${targetId}" not found.`);
  }
  if (!newParentPath) {
    throw new Error(`Parent element with id "${parentId}" not found.`);
  }

  let temp = targetPath.parentPath;
  while (temp) {
    if (temp.isJSXElement()) {
      oldParentPath = temp;
      break;
    }
    temp = temp.parentPath;
  }

  if (!oldParentPath) {
    throw new Error(`Target element has no parent JSXElement.`);
  }

  const targetNode = t.cloneNode(targetPath.node);

  let rootJSXPath = targetPath;
  while (rootJSXPath.parentPath) {
    if (rootJSXPath.parentPath.isJSXElement()) {
      rootJSXPath = rootJSXPath.parentPath;
    } else {
      break;
    }
  }

  // Remove target node from old parent's children
  oldParentPath.node.children = oldParentPath.node.children.filter((child: any) => {
    return child !== targetPath.node;
  });

  // Insert target node into new parent's children
  if (!siblingId || !siblingPath) {
    newParentPath.node.children.push(targetNode);
  } else {
    const siblingIndex = newParentPath.node.children.findIndex((child: any) => child === siblingPath.node);
    if (siblingIndex === -1) {
      newParentPath.node.children.push(targetNode);
    } else {
      const insertIndex = position === 'before' ? siblingIndex : siblingIndex + 1;
      newParentPath.node.children.splice(insertIndex, 0, targetNode);
    }
  }

  const start = rootJSXPath.node.start;
  const end = rootJSXPath.node.end;

  if (start === undefined || end === undefined || start === null || end === null) {
    throw new Error('AST node position ranges are missing.');
  }

  const { code: newJSXCode } = generate(rootJSXPath.node, {
    retainLines: false,
    compact: false,
    comments: true,
  });

  return code.substring(0, start) + newJSXCode + code.substring(end);
}
