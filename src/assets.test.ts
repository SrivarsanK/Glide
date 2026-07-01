import { describe, expect, test, vi } from 'vitest';
import * as fs from 'fs';
import { saveUploadedAsset } from './assets.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

describe('Local Asset Upload Pipeline', () => {
  test('should create public assets directory and copy source file', () => {
    const existsMock = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirMock = vi.spyOn(fs, 'mkdirSync');
    const copyMock = vi.spyOn(fs, 'copyFileSync');

    const result = saveUploadedAsset('/my-project', '/tmp/photo.png', 'logo.png');

    expect(existsMock).toHaveBeenCalled();
    expect(mkdirMock).toHaveBeenCalled();
    expect(copyMock).toHaveBeenCalledWith('/tmp/photo.png', expect.stringContaining('logo.png'));
    expect(result).toBe('/assets/logo.png');
  });
});
