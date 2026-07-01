import { expect, test } from 'vitest';
import { VERSION } from './index.js';

test('version is defined', () => {
  expect(VERSION).toBe('0.1.0');
});
