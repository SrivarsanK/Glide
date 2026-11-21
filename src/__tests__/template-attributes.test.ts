import { describe, expect, test } from 'vitest';
import { transformTemplateBatch } from '../../packages/server/src/template-mutations.js';
import { defaultTailwindTheme } from '../../packages/core/src/index.js';

const theme = defaultTailwindTheme();
const at = (code: string, needle: string) => {
  const index = code.indexOf(needle), before = code.slice(0, index);
  return { line: before.split('\n').length, column: index - before.lastIndexOf('\n') };
};
const set = (file: string, code: string, needle: string, property: string, value: unknown) =>
  transformTemplateBatch(file, code, [{ ...at(code, needle), change: { type: 'attribute', property, value } as any }], theme).code;

const files: Record<string, string> = {
  'App.vue': '<template>\n  <main>\n    <a class="p-2">Go</a>\n    <div id="hero"></div>\n    <a :href="url">Bound</a>\n    <RouterLink to="/">Home</RouterLink>\n  </main>\n</template>\n',
  'App.svelte': "<script>let url = '/';</script>\n<main>\n  <a class=\"p-2\">Go</a>\n  <div id=\"hero\"></div>\n  <a href={url} class={url}>Bound</a>\n</main>\n",
  'Page.astro': "---\nconst url = '/';\n---\n<main>\n  <a class=\"p-2\">Go</a>\n  <div id=\"hero\"></div>\n  <a href={url}>Bound</a>\n</main>\n",
  'index.html': '<main>\n  <a class="p-2">Go</a>\n  <div id="hero"></div>\n  <a href="/x" {...rest}>Bound</a>\n</main>\n',
};

describe.each(Object.keys(files))('attributes in %s', file => {
  const code = files[file];

  test('adds, changes and removes static attributes with the JSX rules', () => {
    // The first <a> in every fixture is the static link.
    let next = set(file, code, '<a ', 'href', '/pricing');
    expect(next).toMatch(/<a [^>]*href="\/pricing"[^>]*>Go<\/a>/);
    next = set(file, next, '<a ', 'target', '_blank');
    expect(next).toMatch(/<a [^>]*target="_blank"[^>]*>Go/);
    expect(next).toMatch(/<a [^>]*rel="noopener noreferrer"[^>]*>Go/);
    next = set(file, next, '<a ', 'href', null);
    expect(next).not.toContain('href="/pricing"');
    // React's names arrive from the editor; templates get the HTML spelling, and true is a bare attribute.
    next = set(file, next, '<div id', 'popover', true);
    next = set(file, next, '<a ', 'popoverTarget', 'hero');
    expect(next).toMatch(/<div popover id="hero">|<div id="hero" popover>/);
    expect(next).toContain('popovertarget="hero"');
  });

  test('refuses unsafe links, unknown attributes and taken ids', () => {
    expect(() => set(file, code, '<a class', 'href', 'javascript:alert(1)')).toThrow(/INVALID_PROP/);
    expect(() => set(file, code, '<a class', 'href', 'java&#115;cript:x')).toThrow(/Character references/);
    expect(() => set(file, code, '<a class', 'onclick', 'x()')).toThrow(/UNSUPPORTED_OPERATION/);
    expect(() => set(file, code, '<a class', 'id', 'hero')).toThrow(/already used/);
    expect(set(file, code, '<div id', 'id', 'hero')).toBe(code);
  });

  test('leaves bound attributes in source', () => {
    const bound = file.endsWith('.vue') ? '<a :href' : file.endsWith('.html') ? '<a href="/x"' : '<a href={url}';
    expect(() => set(file, code, bound, 'href', '/y')).toThrow(/UNSUPPORTED_OPERATION/);
  });
});

const body = '<main>\n  <div class="card">Go</div>\n  <a href="/x"><span>In</span></a>\n  <ul><li>One</li></ul>\n</main>\n';
const retagFiles: Record<string, string> = {
  'App.vue': `<template>\n${body}</template>\n`, 'App.svelte': body, 'Page.astro': `---\n---\n${body}`, 'index.html': body,
};
const retag = (file: string, code: string, needle: string, tagName: string, attributes?: Record<string, unknown>) =>
  transformTemplateBatch(file, code, [{ ...at(code, needle), change: { type: 'retag', tagName, attributes } as any }], theme).code;

describe.each(Object.keys(retagFiles))('retag in %s', file => {
  const code = retagFiles[file];

  test('a frame becomes a link, and a link becomes an overlay button, closing tags included', () => {
    const link = retag(file, code, '<div', 'a', { href: '/pricing' });
    expect(link).toMatch(/<a [^>]*href="\/pricing"[^>]*>Go<\/a>/);
    expect(link).not.toContain('<div');
    // What the Interactions panel sends for "open overlay".
    const button = retag(file, code, '<a ', 'button', { href: null, target: null, rel: null, type: 'button', popoverTarget: 'menu' });
    expect(button).toMatch(/<button [^>]*type="button"[^>]*><span>In<\/span><\/button>/);
    expect(button).toContain('popovertarget="menu"');
    expect(button).not.toContain('href="/x"');
    // Same tag: only the attributes change.
    expect(retag(file, code, '<a ', 'a', { href: '/y' })).toContain('<a href="/y"><span>In</span></a>');
  });

  test('refuses what HTML does not allow', () => {
    expect(() => retag(file, code, '<span', 'a')).toThrow(/inside a link or button/);
    expect(() => retag(file, code, '<div', 'li')).toThrow(/list item/);
    expect(() => retag(file, code, '<ul', 'div')).toThrow(/list items need a list/);
    expect(() => retag(file, code, '<a ', 'div')).toThrow(/Remove href first/);
    expect(() => retag(file, code, '<div', 'script')).toThrow(/not a tag the editor can switch to/);
  });
});

test('an element with a dynamic class still takes attribute edits', () => {
  expect(set('App.svelte', files['App.svelte'], '<a href={url}', 'title', 'More')).toContain('<a title="More" href={url} class={url}>');
});

test('Vue components keep their props in source', () => {
  expect(() => set('App.vue', files['App.vue'], '<RouterLink', 'title', 'x')).toThrow(/Components take props/);
});
