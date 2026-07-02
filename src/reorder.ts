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
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
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

export function insertJSXElement(
  code: string,
  parentId: string,
  elementType: 'rectangle' | 'ellipse' | 'frame' | 'text'
): string {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const openingEl = path.node.openingElement;
      let currentId = '';
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            currentId = attr.value.value;
          }
        }
      });

      if (currentId === parentId) {
        parentPath = path;
      }
    },
  });

  if (!parentPath) {
    throw new Error(`Parent element with id "${parentId}" not found.`);
  }

  let newElement: t.JSXElement;

  if (elementType === 'text') {
    const opening = t.jsxOpeningElement(t.jsxIdentifier('span'), [
      t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(
        t.objectExpression([
          t.objectProperty(t.identifier('color'), t.stringLiteral('#f1f5f9')),
          t.objectProperty(t.identifier('fontSize'), t.stringLiteral('14px')),
        ])
      ))
    ]);
    const closing = t.jsxClosingElement(t.jsxIdentifier('span'));
    newElement = t.jsxElement(opening, closing, [t.jsxText('New Text Element')], false);
  } else {
    let styleProps = [
      t.objectProperty(t.identifier('width'), t.stringLiteral('100px')),
      t.objectProperty(t.identifier('height'), t.stringLiteral('100px')),
    ];

    if (elementType === 'rectangle') {
      styleProps.push(
        t.objectProperty(t.identifier('backgroundColor'), t.stringLiteral('#38bdf8')),
        t.objectProperty(t.identifier('borderRadius'), t.stringLiteral('0px'))
      );
    } else if (elementType === 'ellipse') {
      styleProps.push(
        t.objectProperty(t.identifier('backgroundColor'), t.stringLiteral('#a78bfa')),
        t.objectProperty(t.identifier('borderRadius'), t.stringLiteral('9999px'))
      );
    } else if (elementType === 'frame') {
      styleProps.push(
        t.objectProperty(t.identifier('border'), t.stringLiteral('1px dashed #4b5563')),
        t.objectProperty(t.identifier('backgroundColor'), t.stringLiteral('transparent')),
        t.objectProperty(t.identifier('padding'), t.stringLiteral('16px'))
      );
    }

    const opening = t.jsxOpeningElement(t.jsxIdentifier('div'), [
      t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(
        t.objectExpression(styleProps)
      ))
    ]);
    const closing = t.jsxClosingElement(t.jsxIdentifier('div'));
    newElement = t.jsxElement(opening, closing, [], false);
  }

  parentPath.node.children.push(newElement);

  let rootJSXPath = parentPath;
  while (rootJSXPath.parentPath) {
    if (rootJSXPath.parentPath.isJSXElement()) {
      rootJSXPath = rootJSXPath.parentPath;
    } else {
      break;
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

export function groupJSXElements(code: string, selectedIds: string[]): string {
  if (selectedIds.length === 0) return code;

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const selectedPaths: any[] = [];
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const openingEl = path.node.openingElement;
      let currentId = '';
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            currentId = attr.value.value;
          }
        }
      });

      if (selectedIds.includes(currentId)) {
        selectedPaths.push(path);
      }
    },
  });

  if (selectedPaths.length === 0) {
    throw new Error('None of the selected elements were found in the document.');
  }

  // Find parent path of first selected element
  let firstSelected = selectedPaths[0];
  let temp = firstSelected.parentPath;
  while (temp) {
    if (temp.isJSXElement()) {
      parentPath = temp;
      break;
    }
    temp = temp.parentPath;
  }

  if (!parentPath) {
    throw new Error('Selected elements do not have a parent JSXElement.');
  }

  // Verify all selected elements share the same parent JSX element
  for (const path of selectedPaths) {
    let p: any = null;
    let tPath = path.parentPath;
    while (tPath) {
      if (tPath.isJSXElement()) {
        p = tPath;
        break;
      }
      tPath = tPath.parentPath;
    }
    if (!p || p.node !== parentPath.node) {
      throw new Error('All elements to be grouped must share the same parent container (be siblings).');
    }
  }

  // Find indices of selected elements in parent's children
  const parentNode = parentPath.node;
  const childIndices = selectedPaths.map(path => {
    return parentNode.children.indexOf(path.node);
  }).filter(idx => idx !== -1);

  if (childIndices.length === 0) {
    throw new Error('Selected nodes could not be found within the parent children list.');
  }

  // Sort child indices
  childIndices.sort((a, b) => a - b);
  const insertIndex = childIndices[0];

  // Group children elements in their original order
  const groupedChildrenNodes = childIndices.map(idx => parentNode.children[idx]).map(node => t.cloneNode(node));

  // Remove selected children from parent
  parentNode.children = parentNode.children.filter((child: any, idx: number) => !childIndices.includes(idx));

  // Create new Group div element
  const styleAttr = t.jsxAttribute(
    t.jsxIdentifier('style'),
    t.jsxExpressionContainer(
      t.objectExpression([
        t.objectProperty(t.identifier('position'), t.stringLiteral('relative')),
      ])
    )
  );
  
  const groupOpening = t.jsxOpeningElement(t.jsxIdentifier('div'), [styleAttr]);
  const groupClosing = t.jsxClosingElement(t.jsxIdentifier('div'));
  const groupElement = t.jsxElement(groupOpening, groupClosing, groupedChildrenNodes, false);

  // Insert group element into parent's children
  parentNode.children.splice(insertIndex, 0, groupElement);

  // Get root JSX element path
  let rootJSXPath = parentPath;
  while (rootJSXPath.parentPath) {
    if (rootJSXPath.parentPath.isJSXElement()) {
      rootJSXPath = rootJSXPath.parentPath;
    } else {
      break;
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

export function ungroupJSXElement(code: string, groupId: string): string {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetPath: any = null;
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const openingEl = path.node.openingElement;
      let currentId = '';
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            currentId = attr.value.value;
          }
        }
      });

      if (currentId === groupId) {
        targetPath = path;
      }
    },
  });

  if (!targetPath) {
    throw new Error(`Group element with id "${groupId}" not found.`);
  }

  let temp = targetPath.parentPath;
  while (temp) {
    if (temp.isJSXElement()) {
      parentPath = temp;
      break;
    }
    temp = temp.parentPath;
  }

  if (!parentPath) {
    throw new Error('Group element has no parent JSXElement.');
  }

  const groupNode = targetPath.node;
  const parentNode = parentPath.node;

  // Find index of the group element in its parent's children
  const index = parentNode.children.indexOf(groupNode);
  if (index === -1) {
    throw new Error('Group element could not be found within its parent children list.');
  }

  // Extract children from group element
  const innerChildren = groupNode.children.map((child: any) => t.cloneNode(child));

  // Remove group element and splice in the inner children
  parentNode.children.splice(index, 1, ...innerChildren);

  // Get root JSX element path
  let rootJSXPath = parentPath;
  while (rootJSXPath.parentPath) {
    if (rootJSXPath.parentPath.isJSXElement()) {
      rootJSXPath = rootJSXPath.parentPath;
    } else {
      break;
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

export function arrangeJSXElement(
  code: string,
  targetId: string,
  action: 'front' | 'back' | 'forward' | 'backward'
): string {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetPath: any = null;
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      const openingEl = path.node.openingElement;
      let currentId = '';
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            currentId = attr.value.value;
          }
        }
      });

      if (currentId === targetId) {
        targetPath = path;
      }
    },
  });

  if (!targetPath) {
    throw new Error(`Element with id "${targetId}" not found.`);
  }

  let temp = targetPath.parentPath;
  while (temp) {
    if (temp.isJSXElement()) {
      parentPath = temp;
      break;
    }
    temp = temp.parentPath;
  }

  if (!parentPath) {
    throw new Error('Element has no parent JSXElement.');
  }

  const targetNode = targetPath.node;
  const parentNode = parentPath.node;

  // Find index in parent's children
  const currentIndex = parentNode.children.indexOf(targetNode);
  if (currentIndex === -1) {
    throw new Error('Element could not be found within its parent children list.');
  }

  // Remove element from children
  parentNode.children.splice(currentIndex, 1);

  // Calculate new index
  let newIndex = currentIndex;
  const childrenLength = parentNode.children.length; // Length after removal

  if (action === 'front') {
    newIndex = childrenLength;
  } else if (action === 'back') {
    newIndex = 0;
  } else if (action === 'forward') {
    newIndex = Math.min(childrenLength, currentIndex + 1);
  } else if (action === 'backward') {
    newIndex = Math.max(0, currentIndex - 1);
  }

  // Re-insert at new index
  parentNode.children.splice(newIndex, 0, targetNode);

  // Get root JSX element path
  let rootJSXPath = parentPath;
  while (rootJSXPath.parentPath) {
    if (rootJSXPath.parentPath.isJSXElement()) {
      rootJSXPath = rootJSXPath.parentPath;
    } else {
      break;
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
