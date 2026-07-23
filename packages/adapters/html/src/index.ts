import parseDOMModule from 'html-dom-parser';
import parseReactModule from 'html-react-parser';
import * as React from 'react';
import { mergeInlineStyle, parseTargetId, findTagAtLineCol } from '@srivarsank/core';

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
  let found = false;

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        node.attribs['class'] = updatedClasses;
        found = true;
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  if (found) return serializeDOM(dom);

  // Fallback: match by line:col
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(htmlCode, line, col);
    if (tagLoc) {
      const { tagName, attributes, startIndex, endIndex } = tagLoc;
      const classRegex = /class=(['"])(.*?)\1/;
      const classMatch = attributes.match(classRegex);
      let newFullTag: string;
      if (classMatch) {
        const quote = classMatch[1];
        const newAttributes = attributes.replace(classRegex, `class=${quote}${updatedClasses}${quote}`);
        newFullTag = `<${tagName} ${newAttributes ? ' ' + newAttributes : ''}>`;
      } else {
        const newAttributes = attributes ? `${attributes} class="${updatedClasses}"` : `class="${updatedClasses}"`;
        newFullTag = `<${tagName} ${newAttributes}>`;
      }
      return htmlCode.substring(0, startIndex) + newFullTag + htmlCode.substring(endIndex);
    }
  }

  return htmlCode;
}

/**
 * Parses HTML and updates inline style attribute on a target element matching data-gl-source targetId.
 */
export function updateHTMLStyle(
  htmlCode: string,
  targetId: string,
  styles: Record<string, string>
): string {
  const dom = parseDOM(htmlCode);
  let found = false;

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        const existing = node.attribs['style'] || '';
        node.attribs['style'] = mergeInlineStyle(existing, styles);
        found = true;
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  if (found) return serializeDOM(dom);

  // Fallback: match by line:col
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(htmlCode, line, col);
    if (tagLoc) {
      const { tagName, attributes, startIndex, endIndex } = tagLoc;
      const styleRegex = /style=(['"])(.*?)\1/;
      const styleMatch = attributes.match(styleRegex);
      let newFullTag: string;
      if (styleMatch) {
        const quote = styleMatch[1];
        const existing = styleMatch[2];
        const merged = mergeInlineStyle(existing, styles);
        const newAttributes = attributes.replace(styleRegex, `style=${quote}${merged}${quote}`);
        newFullTag = `<${tagName} ${newAttributes ? ' ' + newAttributes : ''}>`;
      } else {
        const merged = mergeInlineStyle('', styles);
        const newAttributes = attributes ? `${attributes} style="${merged}"` : `style="${merged}"`;
        newFullTag = `<${tagName} ${newAttributes}>`;
      }
      return htmlCode.substring(0, startIndex) + newFullTag + htmlCode.substring(endIndex);
    }
  }

  return htmlCode;
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
  let found = false;

  function traverse(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.type === 'tag' && node.attribs && node.attribs['data-gl-source'] === targetId) {
        node.children = [{ type: 'text', data: newText }];
        found = true;
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  traverse(dom);
  if (found) return serializeDOM(dom);

  // Fallback: match by line:col
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(htmlCode, line, col);
    if (tagLoc) {
      const { tagName, endIndex } = tagLoc;
      const closeTagStr = `</${tagName}>`;
      const restOfCode = htmlCode.substring(endIndex);
      const closeIndex = restOfCode.toLowerCase().indexOf(closeTagStr.toLowerCase());
      if (closeIndex !== -1) {
        const absoluteCloseIndex = endIndex + closeIndex;
        return htmlCode.substring(0, endIndex) + newText + htmlCode.substring(absoluteCloseIndex);
      }
    }
  }

  return htmlCode;
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

