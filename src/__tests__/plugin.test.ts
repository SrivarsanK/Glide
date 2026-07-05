import { describe, expect, test } from 'vitest';
import { glideSourceStamping } from '../../packages/vite-plugin/src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('glideSourceStamping Vite Plugin', () => {
  test('injects data-gl-source attributes in dev mode', () => {
    const plugin = glideSourceStamping();
    
    // Simulate configResolved for serve (dev mode)
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `
      export function App() {
        return (
          <div className="container">
            <h1>Hello World</h1>
            <p>Test</p>
          </div>
        );
      }
    `;

    const filePath = '/project/src/App.tsx';
    
    if (plugin.transform && typeof plugin.transform === 'function') {
      const result = plugin.transform.call({} as any, code, filePath);
      expect(result).not.toBeNull();
      
      const transformedCode = (result as any).code;
      expect(transformedCode).toContain('project/src/App.tsx:4:11"');
      expect(transformedCode).toContain('project/src/App.tsx:5:13"');
      expect(transformedCode).toContain('project/src/App.tsx:6:13"');
      // Bridge is injected via transformIndexHtml, NOT as a module import
      expect(transformedCode).not.toContain("import { GlideBridge");
    } else {
      throw new Error('transform method not found on plugin');
    }
  });

  test('injects inline bridge script into index.html in dev mode', () => {
    const plugin = glideSourceStamping();

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const html = '<html><head></head><body></body></html>';

    if (plugin.transformIndexHtml && typeof plugin.transformIndexHtml === 'function') {
      const result = (plugin.transformIndexHtml as any)(html);
      expect(result).toContain('__glide_initialized__');
      expect(result).toContain('data-gl-source');
      expect(result).toContain('<script>');
    } else {
      throw new Error('transformIndexHtml not found on plugin');
    }
  });

  test('does not inject data-gl-source in production build mode', () => {
    const plugin = glideSourceStamping();
    
    // Simulate configResolved for build (production mode)
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'build', root: '/project' } as any);
    }

    const code = `
      export function App() {
        return (
          <div className="container">
            <h1>Hello World</h1>
          </div>
        );
      }
    `;

    const filePath = '/project/src/App.tsx';

    if (plugin.transform && typeof plugin.transform === 'function') {
      const result = plugin.transform.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('skips node_modules files', () => {
    const plugin = glideSourceStamping();
    
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `<div>Test</div>`;
    const filePath = '/project/node_modules/library/App.tsx';

    if (plugin.transform && typeof plugin.transform === 'function') {
      const result = plugin.transform.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('skips non-JSX/TSX files', () => {
    const plugin = glideSourceStamping();
    
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `const a = 1;`;
    const filePath = '/project/src/index.ts';

    if (plugin.transform && typeof plugin.transform === 'function') {
      const result = plugin.transform.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('handles null entries in glide-positions.json during transformIndexHtml', () => {
    const plugin = glideSourceStamping();
    
    const mockRoot = path.resolve(__dirname, '../../tmp-test-root');
    if (!fs.existsSync(mockRoot)) {
      fs.mkdirSync(mockRoot, { recursive: true });
    }
    const posFile = path.join(mockRoot, 'glide-positions.json');
    const mockPositions = {
      'src/App.tsx:10:5': { position: 'relative', left: '10px' },
      'src/App.tsx:20:5': null
    };
    fs.writeFileSync(posFile, JSON.stringify(mockPositions), 'utf-8');

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: mockRoot } as any);
    }

    try {
      if (plugin.transformIndexHtml && typeof plugin.transformIndexHtml === 'function') {
        const html = '<html><head></head><body></body></html>';
        const result = (plugin.transformIndexHtml as any)(html);
        
        expect(result).toContain('src/App.tsx:10:5');
        expect(result).toContain('position:relative!important');
        expect(result).toContain('left:10px!important');
        expect(result).not.toContain('src/App.tsx:20:5');
      }
    } finally {
      if (fs.existsSync(posFile)) {
        fs.unlinkSync(posFile);
      }
      if (fs.existsSync(mockRoot)) {
        fs.rmdirSync(mockRoot);
      }
    }
  });
});
