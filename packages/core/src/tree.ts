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

  const componentDefs = new Map<string, any>();
  const allComponents: string[] = [];

  traverse(ast, {
    FunctionDeclaration(path: any) {
      const name = path.node.id?.name;
      if (name && name[0] === name[0].toUpperCase()) {
        const jsx = getJSXFromFunction(path, code);
        if (jsx) {
          componentDefs.set(name, jsx);
          allComponents.push(name);
        }
      }
    },
    VariableDeclarator(path: any) {
      const name = path.node.id?.name;
      if (name && name[0] === name[0].toUpperCase()) {
        const init = path.node.init;
        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          const funcPath = path.get('init');
          const jsx = getJSXFromFunction(funcPath, code);
          if (jsx) {
            componentDefs.set(name, jsx);
            allComponents.push(name);
          }
        }
      }
    }
  });

  // Resolve entry/main component
  let entryName = '';
  traverse(ast, {
    ExportDefaultDeclaration(path: any) {
      const decl = path.node.declaration;
      if (decl.type === 'Identifier') {
        entryName = decl.name;
      } else if (decl.type === 'FunctionDeclaration') {
        entryName = decl.id?.name || '';
      }
    }
  });

  if (!entryName || !componentDefs.has(entryName)) {
    if (componentDefs.has('App')) {
      entryName = 'App';
    } else if (allComponents.length > 0) {
      entryName = allComponents[allComponents.length - 1];
    }
  }

  // Fallback: If no components are defined locally, use the old traversal
  if (!entryName || !componentDefs.has(entryName)) {
    const roots: import('./types.js').ComponentTreeNode[] = [];
    const nodeMap = new Map<any, import('./types.js').ComponentTreeNode>();

    traverse(ast, {
      JSXElement(path: any) {
        const openingEl = path.node.openingElement;
        
        let id = '';
        openingEl.attributes.forEach((attr: any) => {
          if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
            if (attr.value && attr.value.type === 'StringLiteral') {
              id = attr.value.value;
            }
          }
        });

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

        let name = '';
        const nameNode = openingEl.name;
        if (nameNode.type === 'JSXIdentifier') {
          name = nameNode.name;
        } else if (nameNode.type === 'JSXMemberExpression') {
          let current = nameNode;
          const parts: string[] = [];
          while (current.type === 'JSXMemberExpression') {
            parts.unshift(current.property.name);
            current = current.object as any;
          }
          parts.unshift((current as any).name);
          name = parts.join('.');
        }

        let className = '';
        openingEl.attributes.forEach((attr: any) => {
          if (attr.type === 'JSXAttribute' && attr.name.name === 'className') {
            if (attr.value && attr.value.type === 'StringLiteral') {
              className = attr.value.value;
            }
          }
        });

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
          if (parentPath.isJSXElement()) {
            jsxParent = parentPath.node;
            break;
          }
          parentPath = parentPath.parentPath;
        }

        if (jsxParent) {
          const parentTreeNode = nodeMap.get(jsxParent);
          if (parentTreeNode) {
            parentTreeNode.children.push(treeNode);
          }
        } else {
          roots.push(treeNode);
        }
      }
    });

    return roots;
  }

  // Recursive tree builder starting from the entry component
  const visited = new Set<string>();

  function buildNode(jsxNode: any): import('./types.js').ComponentTreeNode {
    const isFragment = jsxNode.type === 'JSXFragment';
    const openingEl = isFragment ? null : jsxNode.openingElement;
    
    let id = '';
    if (openingEl) {
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'data-gl-source') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            id = attr.value.value;
          }
        }
      });
    }

    if (!id) {
      const loc = jsxNode.loc;
      if (loc) {
        const start = jsxNode.start;
        const end = jsxNode.end;
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

    let name = 'Fragment';
    if (openingEl) {
      const nameNode = openingEl.name;
      if (nameNode.type === 'JSXIdentifier') {
        name = nameNode.name;
      } else if (nameNode.type === 'JSXMemberExpression') {
        let current = nameNode;
        const parts: string[] = [];
        while (current.type === 'JSXMemberExpression') {
          parts.unshift(current.property.name);
          current = current.object as any;
        }
        parts.unshift((current as any).name);
        name = parts.join('.');
      }
    }

    let className = '';
    if (openingEl) {
      openingEl.attributes.forEach((attr: any) => {
        if (attr.type === 'JSXAttribute' && attr.name.name === 'className') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            className = attr.value.value;
          }
        }
      });
    }

    let text = '';
    if (jsxNode.children) {
      jsxNode.children.forEach((child: any) => {
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

    if (jsxNode.children) {
      jsxNode.children.forEach((child: any) => {
        if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
          let childName = 'Fragment';
          if (child.type === 'JSXElement') {
            const childNameNode = child.openingElement.name;
            if (childNameNode.type === 'JSXIdentifier') {
              childName = childNameNode.name;
            }
          }

          // Resolve component definition if locally defined and not cyclic
          if (childName && childName[0] === childName[0].toUpperCase() && componentDefs.has(childName)) {
            const compNode = buildNode(child);
            if (!visited.has(childName)) {
              visited.add(childName);
              const compJSX = componentDefs.get(childName);
              if (compJSX) {
                const innerNode = buildNode(compJSX);
                compNode.children.push(innerNode);
              }
              visited.delete(childName);
            }
            treeNode.children.push(compNode);
          } else {
            treeNode.children.push(buildNode(child));
          }
        }
      });
    }

    return treeNode;
  }

  const rootJSX = componentDefs.get(entryName);
  if (!rootJSX) return [];

  // Mark the entry component to prevent infinite recursion
  visited.add(entryName);
  const rootNode = buildNode(rootJSX);
  visited.delete(entryName);

  return [rootNode];
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
