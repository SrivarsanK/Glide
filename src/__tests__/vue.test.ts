import { describe, expect, test } from 'vitest';
import { updateVueSFCClass } from '../vue.js';

describe('Vue SFC Transformation Adapter', () => {
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
});
