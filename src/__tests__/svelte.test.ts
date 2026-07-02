import { describe, expect, test } from 'vitest';
import { updateSvelteClass } from '../svelte.js';

describe('Svelte SFC Transformation Adapter', () => {
  test('should update existing class attribute in Svelte templates', () => {
    const svelte = `
      <script>
        let count = 0;
      </script>
      <button class="btn btn-red" data-gl-source="src/Button.svelte:4:7">
        Count: {count}
      </button>
      <style>
        .btn { padding: 8px; }
      </style>
    `;

    const updated = updateSvelteClass(svelte, 'src/Button.svelte:4:7', 'btn btn-blue shadow');

    expect(updated).toContain('class="btn btn-blue shadow"');
    expect(updated).toContain('let count = 0;');
    expect(updated).toContain('.btn { padding: 8px; }');
  });

  test('should inject class attribute if missing from element tag', () => {
    const svelte = `
      <div data-gl-source="src/Card.svelte:2:7">
        Card
      </div>
    `;

    const updated = updateSvelteClass(svelte, 'src/Card.svelte:2:7', 'card p-4 border');

    expect(updated).toContain('<div data-gl-source="src/Card.svelte:2:7" class="card p-4 border">');
  });
});
