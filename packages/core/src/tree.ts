/**
 * Component tree builder — parses JSX AST into a tree for the layers panel.
 * Handles local component definition resolution for unified nesting.
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { computeNodeHash } from './utils.js';
import parseDOMModule from 'html-dom-parser';
import { parse as parseVueSFC } from '@vue/compiler-sfc';

const traverse = (_traverse as any).default || _traverse;
const parseDOM = (parseDOMModule as any).default || parseDOMModule;

export type { ComponentTreeNode } from './types.js';

function findReturnedJSX(functionPath: any, code: string): any | null {
  let returnedJSX: any = null;
  functionPath.traverse({
    ReturnStatement(subPath: any) {
      // Find the first return statement at the function's scope level
      let p = subPath.parentPath;
      while (p && p !== functionPath) {
        if (p.isFunction()) return; // inside a nested function, ignore
        p = p.parentPath;
      }
      const arg = subPath.node.argument;
      if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
        returnedJSX = arg;
      }
    }
  });
  return returnedJSX;
}

function getJSXFromFunction(functionPath: any, code: string): any | null {
  const body = functionPath.node.body;
  if (body && (body.type === 'JSXElement' || body.type === 'JSXFragment')) {
    return body;
  }
  return findReturnedJSX(functionPath, code);
}

export function buildComponentTree(code: string, filepath?: string): import('./types.js').ComponentTreeNode[] {
  const isHTML = filepath?.endsWith('.html');
  const isVue = filepath?.endsWith('.vue');
  const isSvelte = filepath?.endsWith('.svelte');

  if (isHTML || isVue || isSvelte) {
    let templateContent = code;
    if (isVue) {
      try {
        const parsed = parseVueSFC(code);
        templateContent = parsed.descriptor.template?.content || '';
      } catch (e) {
        console.error('[Glide] Vue SFC parse error:', e);
      }
    }

    const dom = parseDOM(templateContent);

    function convertNodes(nodes: any[]): import('./types.js').ComponentTreeNode[] {
      const result: import('./types.js').ComponentTreeNode[] = [];
      for (const node of nodes) {
        if (node.type === 'tag') {
          // Skip script and style tags inside the template (if any)
          if (['script', 'style', 'template'].includes(node.name.toLowerCase())) {
            if (node.children) {
              result.push(...convertNodes(node.children));
            }
            continue;
          }

          let id = node.attribs?.['data-gl-source'] || '';
          if (!id) {
            id = `line:${node.startIndex || 0}:col:${node.endIndex || 0}:${Math.random().toString(36).substring(7)}`;
          }

          const name = node.name;
          const className = node.attribs?.['class'] || node.attribs?.['className'] || '';
          
          let text = '';
          if (node.children) {
            for (const child of node.children) {
              if (child.type === 'text') {
                const val = child.data.trim();
                if (val) {
                  text = val;
                  break;
                }
              }
            }
          }
          if (text && text.length > 25) {
            text = text.substring(0, 22) + '...';
          }

          const treeNode: import('./types.js').ComponentTreeNode = {
            id,
            name,
            children: convertNodes(node.children || []),
            ...(className ? { className } : {}),
            ...(text ? { text } : {})
          };

          result.push(treeNode);
        } else if (node.children) {
          result.push(...convertNodes(node.children));
        }
      }
      return result;
    }

    return convertNodes(dom);
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const roots: import('./types.js').ComponentTreeNode[] = [];
  const nodeMap = new Map<any, import('./types.js').ComponentTreeNode>();

  traverse(ast, {
    JSXElement(path: any) {
      processNode(path);
    },
    JSXFragment(path: any) {
      processNode(path);
    }
  });

  function processNode(path: any) {
    const isFragment = path.node.type === 'JSXFragment';
    let id = '';
    if (!isFragment) {
      id = path.node.openingElement.attributes.find((attr: any) =>
        attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source'
      )?.value?.value;
    }
    if (!id) {
      const loc = path.node.loc;
      if (loc) {
        const start = path.node.start;
        const end = path.node.end;
        let hash = 'nohash';
        if (start != null && end != null) {
          const slice = code.slice(start, end);
          hash = computeNodeHash(slice);
        }
        id = `line:${loc.start.line}:col:${loc.start.column}:${hash}`;
      } else {
        id = Math.random().toString(36).substring(7);
      }
    }

    let name = isFragment ? 'Fragment' : 'div';
    if (!isFragment) {
      const nameNode = path.node.openingElement.name;
      if (nameNode.type === 'JSXIdentifier') {
        name = nameNode.name;
      } else if (nameNode.type === 'JSXMemberExpression') {
        let part = nameNode;
        const nameParts: string[] = [];
        while (part) {
          if (part.type === 'JSXMemberExpression') {
            nameParts.unshift(part.property.name);
            part = part.object;
          } else if (part.type === 'JSXIdentifier') {
            nameParts.unshift(part.name);
            break;
          }
        }
        name = nameParts.join('.');
      }
    }

    let className = '';
    if (!isFragment) {
      path.node.openingElement.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'className') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            className = attr.value.value;
          }
        }
      });
    }

    let text = '';
    if (path.node.children) {
      path.node.children.forEach((child: any) => {
        if (child.type === 'JSXText') {
          const val = child.value.trim();
          if (val) text = val;
        } else if (child.type === 'JSXExpressionContainer' && child.expression.type === 'StringLiteral') {
          text = child.expression.value;
        }
      });
    }
    if (text && text.length > 25) {
      text = text.substring(0, 22) + '...';
    }

    const treeNode: import('./types.js').ComponentTreeNode = {
      id,
      name,
      children: [],
      ...(className ? { className } : {}),
      ...(text ? { text } : {}),
    };

    nodeMap.set(path.node, treeNode);

    let parentPath = path.parentPath;
    let jsxParent: any = null;
    while (parentPath) {
      if (parentPath.isJSXElement() || parentPath.isJSXFragment()) {
        jsxParent = parentPath.node;
        break;
      }
      parentPath = parentPath.parentPath;
    }

    if (jsxParent) {
      const parentTreeNode = nodeMap.get(jsxParent);
      if (parentTreeNode) {
        parentTreeNode.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

export function getNestingPath(tree: import('./types.js').ComponentTreeNode[], selectedId: string): string[] {
  function find(nodes: import('./types.js').ComponentTreeNode[], targetId: string): string[] | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [node.name];
      }
      const childPath = find(node.children, targetId);
      if (childPath) {
        return [node.name, ...childPath];
      }
    }
    return null;
  }
  return find(tree, selectedId) || [];
}
