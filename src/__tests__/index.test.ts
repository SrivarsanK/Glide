import { expect, test } from 'vitest';
import { VERSION, glideSourceStamping, GlideServer } from '../index.js';
import packageInfo from '../../package.json';

test('exports are defined', () => {
  expect(VERSION).toBe(packageInfo.version);
  expect(glideSourceStamping).toBeDefined();
  expect(GlideServer).toBeDefined();
});
