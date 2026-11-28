import { describe, expect, test } from 'vitest';
import {
  readVueClass,
  readVueTag,
  renameVueTag,
  updateVueSFCAttribute,
  updateVueSFCClass,
  updateVueSFCStyle,
  updateVueSFCText,
} from '../../packages/adapters/vue/src/index.js';

describe('Vue SFC Transformation Adapter', () => {
  test('targets whole-file CRLF coordinates after script and preserves multiline neighbors', () => {
    const code = '<script setup>const n = 1</script>\r\n<template>\r\n  <div\r\n    title="n > 0" class="one">Hello <strong>{{n}}</strong></div><div class="one" />\r\n</template>';
    expect(updateVueSFCClass(code, 'App.vue:3:3', 'two')).toBe(code.replace('class="one"', 'class="two"'));
    const text = updateVueSFCText(code, 'App.vue:3:3', '<&>{{literal}}');
    expect(text).toContain('<strong>{{n}}</strong>');
    expect(text).toContain('&lt;&amp;&gt;&#123;&#123;literal&#125;&#125;');
    expect(text).toContain('\r\n');
  });
  test.each([':class="classes"', 'v-bind="props"', 'v-bind:[key]="value"'])('rejects dynamic class form %s', attr => {
    expect(() => updateVueSFCClass(`<template><div ${attr} /></template>`, 'App.vue:1:11', 'p-4')).toThrow('UNSUPPORTED_OPERATION');
  });
  test('preserves dynamic styles and rejects ambiguous text ranges', () => {
    expect(() => updateVueSFCStyle('<template><div :style="theme" /></template>', 'App.vue:1:11', { color: 'red' })).toThrow('UNSUPPORTED_OPERATION');
    expect(() => updateVueSFCText('<template><p>Hello <b>{{name}}</b>!</p></template>', 'App.vue:1:11', 'New')).toThrow('UNSUPPORTED_OPERATION');
  });
  test('should update existing class attribute in template block', () => {
    const sfc = `
      <template>
        <div class="p-4 bg-red-500" data-gl-source="src/App.vue:3:9">
          <p>Hello</p>
        </div>
      </template>
      <script>
      export default { name: 'App' }
      </script>
    `;

    const updated = updateVueSFCClass(sfc, 'src/App.vue:3:9', 'p-6 bg-blue-500 rounded');

    expect(updated).toContain('class="p-6 bg-blue-500 rounded"');
    expect(updated).toContain("export default { name: 'App' }");
  });

  test('should create class attribute if missing from element tag', () => {
    const sfc = `
      <template>
        <div data-gl-source="src/App.vue:3:9">
          <p>Hello</p>
        </div>
      </template>
    `;

    const updated = updateVueSFCClass(sfc, 'src/App.vue:3:9', 'p-4 shadow');

    expect(updated).toContain('<div data-gl-source="src/App.vue:3:9" class="p-4 shadow">');
  });

  test('readVueClass handles uppercase CLASS and refuses dynamic :class bindings', () => {
    const upper = '<template><div CLASS="p-2 flex">Hi</div></template>';
    expect(readVueClass(upper, 'App.vue:1:11')).toBe('p-2 flex');
    expect(() => readVueClass('<template><div :class="cls">Hi</div></template>', 'App.vue:1:11')).toThrow('UNSUPPORTED_OPERATION');
  });

  test('readVueTag detects camelCase tabIndex/:tabIndex and ignores @tabindex events', () => {
    const sfc = '<template><div><span tabIndex="0">A</span><em :tabIndex="0">B</em><b @tabindex="fn">C</b></div></template>';
    const tag = readVueTag(sfc, 'App.vue:1:11');
    expect(tag.descendants).toEqual([
      { tag: 'span', focusable: true },
      { tag: 'em', focusable: true },
      { tag: 'b', focusable: false },
    ]);
  });

  test('renameVueTag refuses void elements like <img /> and writers throw NODE_NOT_FOUND on missing targets', () => {
    const img = '<template><img src="/a.png" /></template>';
    expect(() => renameVueTag(img, 'App.vue:1:11', 'div')).toThrow('UNSUPPORTED_OPERATION');
    const sfc = '<template><div>Hi</div></template>';
    expect(() => updateVueSFCClass(sfc, 'App.vue:99:1', 'p-4')).toThrow('NODE_NOT_FOUND');
    expect(() => updateVueSFCStyle(sfc, 'App.vue:99:1', { color: 'red' })).toThrow('NODE_NOT_FOUND');
    expect(() => updateVueSFCAttribute(sfc, 'App.vue:99:1', 'title', 'x')).toThrow('NODE_NOT_FOUND');
    expect(() => updateVueSFCText(sfc, 'App.vue:99:1', 'x')).toThrow('NODE_NOT_FOUND');
  });
});
