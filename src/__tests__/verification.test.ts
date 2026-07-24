import { describe, expect, test } from 'vitest';
import { updateAstroStyle, updateAstroText, updateAstroClass } from '../../packages/adapters/astro/src/index.ts';
import { updateVueSFCStyle, updateVueSFCText, updateVueSFCClass } from '../../packages/adapters/vue/src/index.ts';
import { updateSvelteStyle, updateSvelteText, updateSvelteClass } from '../../packages/adapters/svelte/src/index.ts';
import { updateHTMLStyle, updateHTMLText, updateHTMLClass } from '../../packages/adapters/html/src/index.ts';
import { updateJSXStyleProp, updateJSXText, updateClassName } from '../../packages/ast-writer/src/index.ts';

describe('Comprehensive Pipeline & Bug Verification', () => {

  describe('Astro Adapter Fallback (No data-gl-source attribute in source file)', () => {
    const rawAstro = `---\nconst title = "Store";\n---\n<Layout>\n  <h1 class="hero-title">Nexus Store</h1>\n  <p class="hero-subtitle" style="width: 564px; height: 350px">Description here</p>\n</Layout>`;

    test('updateAstroStyle should update style via line:col fallback', () => {
      // Line 6 is <p class="hero-subtitle"...>
      const updated = updateAstroStyle(rawAstro, 'src/pages/index.astro:6:7', { width: '800px' });
      expect(updated).not.toBe(rawAstro);
      expect(updated).toContain('width: 800px');
      expect(updated).toContain('height: 350px');
    });

    test('updateAstroText should update text via line:col fallback', () => {
      const updated = updateAstroText(rawAstro, 'src/pages/index.astro:5:7', 'Updated Store Title');
      expect(updated).not.toBe(rawAstro);
      expect(updated).toContain('Updated Store Title');
    });

    test('updateAstroClass should update class via line:col fallback', () => {
      const updated = updateAstroClass(rawAstro, 'src/pages/index.astro:5:7', 'hero-title active');
      expect(updated).not.toBe(rawAstro);
      expect(updated).toContain('class="hero-title active"');
    });
  });

  describe('No-op Detection Verification', () => {
    test('updateAstroStyle returns unchanged code when line:col is invalid', () => {
      const code = `<div>Hello</div>`;
      const result = updateAstroStyle(code, 'src/App.astro:999:999', { color: 'red' });
      expect(result).toBe(code);
    });

    test('updateVueSFCStyle returns unchanged code when line:col is invalid', () => {
      const code = `<template><div>Hello</div></template>`;
      const result = updateVueSFCStyle(code, 'src/App.vue:999:999', { color: 'red' });
      expect(result).toBe(code);
    });
  });

  describe('Vue Adapter Fallback', () => {
    const rawVue = `<template>\n  <div class="card">\n    <h2 class="title">Product</h2>\n  </div>\n</template>`;

    test('updateVueSFCStyle via line:col fallback', () => {
      const updated = updateVueSFCStyle(rawVue, 'src/Card.vue:3:5', { color: 'green' });
      expect(updated).not.toBe(rawVue);
      expect(updated).toContain('style="color: green"');
    });

    test('updateVueSFCText via line:col fallback', () => {
      const updated = updateVueSFCText(rawVue, 'src/Card.vue:3:5', 'New Product');
      expect(updated).not.toBe(rawVue);
      expect(updated).toContain('New Product');
    });
  });

  describe('Svelte Adapter Fallback', () => {
    const rawSvelte = `<main>\n  <h1>Svelte App</h1>\n</main>`;

    test('updateSvelteStyle via line:col fallback', () => {
      const updated = updateSvelteStyle(rawSvelte, 'src/App.svelte:2:3', { margin: '10px' });
      expect(updated).not.toBe(rawSvelte);
      expect(updated).toContain('style="margin: 10px"');
    });
  });

  describe('HTML Adapter Fallback', () => {
    const rawHTML = `<!DOCTYPE html>\n<html>\n<body>\n  <div id="root">Hello</div>\n</body>\n</html>`;

    test('updateHTMLStyle via line:col fallback', () => {
      const updated = updateHTMLStyle(rawHTML, 'index.html:4:3', { background: 'black' });
      expect(updated).not.toBe(rawHTML);
      expect(updated).toContain('style="background: black"');
    });
  });

});
