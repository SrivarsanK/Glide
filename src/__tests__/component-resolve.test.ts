import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveComponentDefinition } from '../../packages/core/src/resolve.js';

describe('Component Definition Resolver', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-resolve-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('should resolve local function component in the same file', () => {
    const code = `
      import React from 'react';

      function Header() {
        return <header>Glide</header>;
      }

      export function App() {
        return (
          <div>
            <Header />
          </div>
        );
      }
    `;

    const filepath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(filepath, code, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: code,
      filepath,
      componentName: 'Header',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.componentName).toBe('Header');
    expect(result?.file).toBe(path.resolve(filepath));
    expect(result?.line).toBe(4);
    expect(result?.isLocal).toBe(true);
    expect(result?.exportType).toBe('local');
  });

  test('should resolve local const arrow function component in the same file', () => {
    const code = `
      import React from 'react';

      const Badge = ({ text }) => <span>{text}</span>;

      export function App() {
        return <Badge text="New" />;
      }
    `;

    const filepath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(filepath, code, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: code,
      filepath,
      componentName: 'Badge',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.line).toBe(4);
    expect(result?.isLocal).toBe(true);
  });

  test('should resolve member expression component (Card.Title) to Card definition', () => {
    const code = `
      const Card = {
        Title: () => <h1>Title</h1>
      };

      export function App() {
        return <Card.Title />;
      }
    `;

    const filepath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(filepath, code, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: code,
      filepath,
      componentName: 'Card.Title',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.componentName).toBe('Card.Title');
    expect(result?.line).toBe(2);
    expect(result?.isLocal).toBe(true);
  });

  test('should resolve imported default component to separate file', () => {
    const buttonCode = `
      import React from 'react';

      export default function Button({ children }) {
        return <button>{children}</button>;
      }
    `;

    const appCode = `
      import React from 'react';
      import Button from './Button';

      export function App() {
        return <Button>Click me</Button>;
      }
    `;

    const buttonPath = path.join(tmpDir, 'Button.tsx');
    const appPath = path.join(tmpDir, 'App.tsx');

    fs.writeFileSync(buttonPath, buttonCode, 'utf-8');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'Button',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.componentName).toBe('Button');
    expect(result?.file).toBe(path.resolve(buttonPath));
    expect(result?.line).toBe(4);
    expect(result?.isLocal).toBe(false);
    expect(result?.exportType).toBe('default');
  });

  test('should resolve imported named component to exact export line', () => {
    const uiCode = `
      import React from 'react';

      export function Avatar() {
        return <img src="avatar.png" />;
      }

      export function Chip() {
        return <span>Chip</span>;
      }
    `;

    const appCode = `
      import React from 'react';
      import { Chip } from './ui';

      export function App() {
        return <Chip />;
      }
    `;

    const uiPath = path.join(tmpDir, 'ui.tsx');
    const appPath = path.join(tmpDir, 'App.tsx');

    fs.writeFileSync(uiPath, uiCode, 'utf-8');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'Chip',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.componentName).toBe('Chip');
    expect(result?.file).toBe(path.resolve(uiPath));
    expect(result?.line).toBe(8);
    expect(result?.isLocal).toBe(false);
    expect(result?.exportType).toBe('named');
  });

  test('should resolve aliased import (@/components/Banner)', () => {
    const srcDir = path.join(tmpDir, 'src', 'components');
    fs.mkdirSync(srcDir, { recursive: true });

    const bannerCode = `
      export default function Banner() {
        return <div>Banner</div>;
      }
    `;
    const bannerPath = path.join(srcDir, 'Banner.tsx');
    fs.writeFileSync(bannerPath, bannerCode, 'utf-8');

    const appCode = `
      import Banner from '@/components/Banner';

      export function App() {
        return <Banner />;
      }
    `;
    const appPath = path.join(tmpDir, 'src', 'App.tsx');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'Banner',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.file).toBe(path.resolve(bannerPath));
    expect(result?.line).toBe(2);
  });

  test('should resolve imported Vue SFC component', () => {
    const vueCode = `<template><button>Vue Button</button></template>`;
    const vuePath = path.join(tmpDir, 'VueBtn.vue');
    fs.writeFileSync(vuePath, vueCode, 'utf-8');

    const appCode = `
      import VueBtn from './VueBtn.vue';
      export function App() { return <VueBtn />; }
    `;
    const appPath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'VueBtn',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.file).toBe(path.resolve(vuePath));
    expect(result?.line).toBe(1);
    expect(result?.exportType).toBe('sfc');
  });

  test('should fallback to glide-components.json when import is missing', () => {
    const cardPath = path.join(tmpDir, 'Card.tsx');
    fs.writeFileSync(cardPath, `export function Card() { return <div>Card</div>; }`, 'utf-8');

    const registry = {
      projectRoot: tmpDir,
      generatedAt: new Date().toISOString(),
      framework: 'react',
      buckets: [
        {
          name: 'Card',
          file: cardPath,
          exportType: 'named',
          line: 1,
          column: 0,
          elements: [],
          cssFiles: []
        }
      ]
    };

    fs.writeFileSync(path.join(tmpDir, 'glide-components.json'), JSON.stringify(registry), 'utf-8');

    const appCode = `
      export function App() {
        return <Card />;
      }
    `;
    const appPath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'Card',
      projectRoot: tmpDir
    });

    expect(result).not.toBeNull();
    expect(result?.file).toBe(path.resolve(cardPath));
    expect(result?.componentName).toBe('Card');
  });

  test('should return null when component cannot be resolved', () => {
    const appCode = `
      export function App() {
        return <NonExistentComponent />;
      }
    `;
    const appPath = path.join(tmpDir, 'App.tsx');
    fs.writeFileSync(appPath, appCode, 'utf-8');

    const result = resolveComponentDefinition({
      sourceCode: appCode,
      filepath: appPath,
      componentName: 'NonExistentComponent',
      projectRoot: tmpDir
    });

    expect(result).toBeNull();
  });
});
