import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { computeNodeHash } from './writer.js';

const traverse = (_traverse as any).default || _traverse;

export interface ComponentTreeNode {
  id: string;
  name: string;
  className?: string;
  text?: string;
  children: ComponentTreeNode[];
}

export function buildComponentTree(code: string): ComponentTreeNode[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const roots: ComponentTreeNode[] = [];
  const nodeMap = new Map<any, ComponentTreeNode>();

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
        const parts = [];
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

      const treeNode: ComponentTreeNode = {
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

export function getNestingPath(tree: ComponentTreeNode[], selectedId: string): string[] {
  function find(nodes: ComponentTreeNode[], targetId: string): string[] | null {
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
