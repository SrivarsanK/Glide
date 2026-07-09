import { describe, expect, test } from 'vitest';
import { buildComponentTree, getNestingPath } from '../../packages/core/src/tree.js';

describe('Universal Component Tree Parser', () => {
  test('should parse HTML file templates into tree structures', () => {
    const htmlCode = `
      <div class="container" data-gl-source="src/index.html:2:7">
        <header data-gl-source="src/index.html:3:9">
          <h1 class="title" data-gl-source="src/index.html:4:11">Title</h1>
        </header>
        <main data-gl-source="src/index.html:6:9">
          <section data-gl-source="src/index.html:7:11">
            <p data-gl-source="src/index.html:8:13">Hello World</p>
          </section>
        </main>
      </div>
    `;

    const tree = buildComponentTree(htmlCode, 'src/index.html');

    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.name).toBe('div');
    expect(root.id).toBe('src/index.html:2:7');
    expect(root.className).toBe('container');
    expect(root.children).toHaveLength(2);

    const [header, main] = root.children;
    expect(header.name).toBe('header');
    expect(header.children).toHaveLength(1);
    expect(header.children[0].name).toBe('h1');
    expect(header.children[0].className).toBe('title');
    expect(header.children[0].text).toBe('Title');

    expect(main.name).toBe('main');
    expect(main.children).toHaveLength(1);
    expect(main.children[0].name).toBe('section');
    expect(main.children[0].children).toHaveLength(1);
    expect(main.children[0].children[0].name).toBe('p');
    expect(main.children[0].children[0].text).toBe('Hello World');
  });

  test('should parse Vue SFC template content and extract tree structures', () => {
    const vueCode = `
      <template>
        <div id="app" data-gl-source="src/App.vue:3:9">
          <custom-button data-gl-source="src/App.vue:4:11">Click Me</custom-button>
        </div>
      </template>
      <script>
      export default {
        name: 'App'
      };
      </script>
      <style scoped>
      #app { padding: 10px; }
      </style>
    `;

    const tree = buildComponentTree(vueCode, 'src/App.vue');

    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.name).toBe('div');
    expect(root.id).toBe('src/App.vue:3:9');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe('custom-button');
    expect(root.children[0].id).toBe('src/App.vue:4:11');
    expect(root.children[0].text).toBe('Click Me');
  });

  test('should parse Svelte files and build tree structures', () => {
    const svelteCode = `
      <script>
      let count = 0;
      </script>

      <div class="counter" data-gl-source="src/Counter.svelte:5:7">
        <button data-gl-source="src/Counter.svelte:6:9">Count: {count}</button>
      </div>

      <style>
      .counter { color: red; }
      </style>
    `;

    const tree = buildComponentTree(svelteCode, 'src/Counter.svelte');

    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.name).toBe('div');
    expect(root.id).toBe('src/Counter.svelte:5:7');
    expect(root.className).toBe('counter');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe('button');
    expect(root.children[0].id).toBe('src/Counter.svelte:6:9');
    expect(root.children[0].text).toBe('Count: {count}');
  });
});
