import parseDOMModule from 'html-dom-parser';
import parseReactModule from 'html-react-parser';
import * as React from 'react';

const parseDOM = (parseDOMModule as any).default || parseDOMModule;
const parseReact = (parseReactModule as any).default || parseReactModule;


/**
 * Serializes a DOM node tree parsed by html-dom-parser back into a standard HTML string.
 */
export function serializeDOM(nodes: any[]): string {
  return nodes.map(node => {
    if (node.type === 'text') {
      return node.data;
    }
    if (node.type === 'comment') {
      return `<!--${node.data}-->`;
    }
    if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
      const attribs = Object.entries(node.attribs || {})
        .map(([key, val]) => ` ${key}="${val}"`)
        .join('');
      
      const selfClosing = ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(node.name);
      if (selfClosing && (!node.children || node.children.length === 0)) {
        return `<${node.name}${attribs}/>`;
      }
      
      const children = serializeDOM(node.children || []);
      return `<${node.name}${attribs}>${children}</${node.name}>`;
    }
    return '';
  }).join('');
}

/**
 * Parses HTML and updates a class attribute on a target element matching data-gl-source targetId.
 */
export function updateHTMLClass(
  htmlCode: string,
  targetId: string,
  updatedClasses: string
): string {
  const dom = parseDOM(htmlCode);

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        node.attribs['class'] = updatedClasses;
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  return serializeDOM(dom);
}

/**
 * Parses HTML and updates the inner text of a target element matching data-gl-source targetId.
 */
export function updateHTMLText(
  htmlCode: string,
  targetId: string,
  newText: string
): string {
  const dom = parseDOM(htmlCode);

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        node.children = [{ type: 'text', data: newText }];
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  return serializeDOM(dom);
}

/**
 * Converts a raw HTML snippet into React elements using html-react-parser.
 */
export function parseHTMLToReact(htmlSnippet: string): any {
  return parseReact(htmlSnippet);
}

/**
 * Parses an HTML/Vue/Svelte template and returns the class attribute of the element matching the data-gl-source.
 */
export function getElementClass(template: string, targetId: string): string {
  const dom = parseDOM(template);
  let classVal = '';

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        classVal = node.attribs['class'] || node.attribs['className'] || '';
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  return classVal;
}

