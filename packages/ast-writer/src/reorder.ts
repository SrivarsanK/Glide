import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { parse as recastParse, print as recastPrint } from 'recast';
import * as babelParser from 'recast/parsers/babel.js';
import getBabelOptions from 'recast/parsers/_babel_options.js';

const tsxParser = {
  parse(source: string, options?: any) {
    const getOpts = (getBabelOptions as any).default || getBabelOptions;
    const babelOptions = getOpts(options);
    babelOptions.plugins = babelOptions.plugins.filter((p: string) => p !== 'flow');
    babelOptions.plugins.push('jsx', 'typescript', 'decoratorAutoAccessors');
    return babelParser.parser.parse(source, babelOptions);
  }
};

const traverse = (traverseModule as any).default || traverseModule;

function matchesSourceId(path: any, targetId: string): boolean {
  if (!targetId) return false;
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
    return true;
  }

  const parts = targetId.split(':');
  let lineNum = NaN;
  let colNum = NaN;
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    const thirdLast = parts[parts.length - 3];
    const lastAsNum = parseInt(last, 10);
    const secondLastAsNum = parseInt(secondLast, 10);
    const thirdLastAsNum = parseInt(thirdLast, 10);
    if (!isNaN(secondLastAsNum) && !isNaN(lastAsNum)) {
      lineNum = secondLastAsNum;
      colNum = lastAsNum;
    } else if (!isNaN(thirdLastAsNum) && !isNaN(secondLastAsNum)) {
      lineNum = thirdLastAsNum;
      colNum = secondLastAsNum;
    }
  }

  if (!isNaN(lineNum) && !isNaN(colNum) && path.node.loc) {
    const loc = path.node.loc;
    return loc.start.line === lineNum && (loc.start.column + 1) === colNum;
  }

  return false;
}

export function reorderJSXElement(
  code: string,
  targetId: string,
  parentId: string,
  siblingId: string | null,
  position: 'before' | 'after'
): string {
  const ast = recastParse(code, { parser: tsxParser });

  let targetPath: any = null;
  let oldParentPath: any = null;
  let newParentPath: any = null;
  let siblingPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (matchesSourceId(path, targetId)) {
        targetPath = path;
      }
      if (matchesSourceId(path, parentId)) {
        newParentPath = path;
      }
      if (siblingId && matchesSourceId(path, siblingId)) {
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
    if (temp.isJSXElement() || temp.isJSXFragment()) {
      oldParentPath = temp;
      break;
    }
    temp = temp.parentPath;
  }

  if (!oldParentPath) {
    throw new Error(`Target element has no parent JSXElement.`);
  }

  const targetNode = targetPath.node;

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

  return recastPrint(ast).code;
}

export function insertJSXElement(
  code: string,
  parentId: string,
  elementType: 'rectangle' | 'ellipse' | 'frame' | 'text'
): string {
  const ast = recastParse(code, { parser: tsxParser });

  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (matchesSourceId(path, parentId)) {
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

  return recastPrint(ast).code;
}

export function groupJSXElements(code: string, selectedIds: string[]): string {
  if (selectedIds.length === 0) return code;

  const ast = recastParse(code, { parser: tsxParser });

  const selectedPaths: any[] = [];
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (selectedIds.some(id => matchesSourceId(path, id))) {
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
    if (temp.isJSXElement() || temp.isJSXFragment()) {
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
      if (tPath.isJSXElement() || tPath.isJSXFragment()) {
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
  const groupedChildrenNodes = childIndices.map(idx => parentNode.children[idx]);

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
  
  const idAttr = t.jsxAttribute(
    t.jsxIdentifier('id'),
    t.stringLiteral(`group-${Math.random().toString(36).substring(7)}`)
  );
  const groupOpening = t.jsxOpeningElement(t.jsxIdentifier('div'), [idAttr, styleAttr]);
  const groupClosing = t.jsxClosingElement(t.jsxIdentifier('div'));
  const groupElement = t.jsxElement(groupOpening, groupClosing, groupedChildrenNodes, false);

  // Insert group element into parent's children
  parentNode.children.splice(insertIndex, 0, groupElement);

  return recastPrint(ast).code;
}

export function ungroupJSXElement(code: string, groupId: string): string {
  const ast = recastParse(code, { parser: tsxParser });

  let targetPath: any = null;
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (matchesSourceId(path, groupId)) {
        targetPath = path;
      }
    },
  });

  if (!targetPath) {
    throw new Error(`Group element with id "${groupId}" not found.`);
  }

  let temp = targetPath.parentPath;
  while (temp) {
    if (temp.isJSXElement() || temp.isJSXFragment()) {
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
  const innerChildren = groupNode.children;

  // Remove group element and splice in the inner children
  parentNode.children.splice(index, 1, ...innerChildren);

  return recastPrint(ast).code;
}

export function arrangeJSXElement(
  code: string,
  targetId: string,
  action: 'front' | 'back' | 'forward' | 'backward'
): string {
  const ast = recastParse(code, { parser: tsxParser });

  let targetPath: any = null;
  let parentPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (matchesSourceId(path, targetId)) {
        targetPath = path;
      }
    },
  });

  if (!targetPath) {
    throw new Error(`Element with id "${targetId}" not found.`);
  }

  let temp = targetPath.parentPath;
  while (temp) {
    if (temp.isJSXElement() || temp.isJSXFragment()) {
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

  return recastPrint(ast).code;
}
