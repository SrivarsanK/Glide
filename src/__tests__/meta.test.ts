import { describe, expect, test, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { detectProjectMeta, generateVSCodeConfig } from '../meta.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('Project Metadata & IDE Configuration', () => {
  test('should detect Next.js React project structure', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        dependencies: {
          react: '^18.0.0',
          next: '^14.0.0',
        },
      })
    );

    const meta = detectProjectMeta('/projects/app');

    expect(meta.framework).toBe('react');
    expect(meta.metaFramework).toBe('next');
    expect(meta.srcDir).toBe(path.join('/projects/app', 'src'));
  });

  test('should detect Nuxt Vue project structure', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true).mockReturnValueOnce(false);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        dependencies: {
          vue: '^3.0.0',
          nuxt: '^3.0.0',
        },
      })
    );

    const meta = detectProjectMeta('/projects/vue-app');

    expect(meta.framework).toBe('vue');
    expect(meta.metaFramework).toBe('nuxt');
    expect(meta.srcDir).toBe('/projects/vue-app'); // no src folder simulated
  });

  test('should generate VS Code editor settings', () => {
    const existsMock = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirMock = vi.spyOn(fs, 'mkdirSync');
    const writeMock = vi.spyOn(fs, 'writeFileSync');

    generateVSCodeConfig('/my-project');

    expect(mkdirMock).toHaveBeenCalledWith(path.join('/my-project', '.vscode'), { recursive: true });
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining('settings.json'),
      expect.stringContaining('"glide.enabled": true'),
      'utf-8'
    );
  });
});
