import { expect, test } from 'vitest';
import { VERSION, glideSourceStamping, GlideServer } from './index.js';

test('exports are defined', () => {
  expect(VERSION).toBe('0.1.0');
  expect(glideSourceStamping).toBeDefined();
  expect(GlideServer).toBeDefined();
});
