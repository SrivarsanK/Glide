import { describe, expect, test } from 'vitest';
import { updateVueSFCStyle, updateVueSFCText } from '../../packages/adapters/vue/src/index.ts';
import { updateSvelteStyle, updateSvelteText } from '../../packages/adapters/svelte/src/index.ts';
import { updateAstroStyle, updateAstroText } from '../../packages/adapters/astro/src/index.ts';
import { updateHTMLStyle, updateHTMLText } from '../../packages/adapters/html/src/index.ts';

describe('Universal Framework Writeback Integration', () => {
  const targetId = 'src/App:10:5';

  describe('Vue Adapter', () => {
    test('should update inline style attribute with camelCase to kebab-case conversion', () => {
      const vfc = `<template><div data-gl-source="${targetId}">Hello</div></template>`;
      const updated = updateVueSFCStyle(vfc, targetId, { backgroundColor: '#ff0000', fontSize: '18px' });
      expect(updated).toContain('style="background-color: #ff0000; font-size: 18px"');
    });

    test('should update text content', () => {
      const vfc = `<template><h1 data-gl-source="${targetId}">Old Title</h1></template>`;
      const updated = updateVueSFCText(vfc, targetId, 'New Title');
      expect(updated).toContain('<h1 data-gl-source="src/App:10:5">New Title</h1>');
    });
  });

  describe('Svelte Adapter', () => {
    test('should update inline style attribute', () => {
      const svelte = `<button data-gl-source="${targetId}">Click</button>`;
      const updated = updateSvelteStyle(svelte, targetId, { color: 'blue', marginTop: '10px' });
      expect(updated).toContain('style="color: blue; margin-top: 10px"');
    });

    test('should update text content', () => {
      const svelte = `<p data-gl-source="${targetId}">Old paragraph</p>`;
      const updated = updateSvelteText(svelte, targetId, 'Updated text');
      expect(updated).toContain('<p data-gl-source="src/App:10:5">Updated text</p>');
    });
  });

  describe('Astro Adapter', () => {
    test('should update inline style attribute preserving frontmatter', () => {
      const astro = `---\nconst x = 1;\n---\n<div data-gl-source="${targetId}">Astro</div>`;
      const updated = updateAstroStyle(astro, targetId, { opacity: '0.8' });
      expect(updated).toContain('---\nconst x = 1;\n---');
      expect(updated).toContain('style="opacity: 0.8"');
    });

    test('should update text content preserving frontmatter', () => {
      const astro = `---\nimport Header from './Header.astro';\n---\n<span data-gl-source="${targetId}">Label</span>`;
      const updated = updateAstroText(astro, targetId, 'New Label');
      expect(updated).toContain('---\nimport Header from ./Header.astro;\n---'.replace('./Header.astro', '\'./Header.astro\''));
      expect(updated).toContain('New Label');
    });
  });

  describe('HTML Adapter', () => {
    test('should update inline style attribute', () => {
      const html = `<section data-gl-source="${targetId}">Content</section>`;
      const updated = updateHTMLStyle(html, targetId, { display: 'flex', flexDirection: 'column' });
      expect(updated).toContain('style="display: flex; flex-direction: column"');
    });

    test('should update text content', () => {
      const html = `<div data-gl-source="${targetId}"><span>Old</span></div>`;
      const updated = updateHTMLText(html, targetId, 'Replaced Content');
      expect(updated).toContain('Replaced Content');
    });
  });
});
