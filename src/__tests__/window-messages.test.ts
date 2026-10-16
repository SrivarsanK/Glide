import { expect, test } from 'vitest';
import { trustedWindowMessage } from '../../packages/core/src/window-messages.js';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import { buildBridgeScript } from '../../packages/vite-plugin/src/index.js';
import { buildGlideBridgeInlineScript } from '../../packages/server/src/ws-server.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/index.js';

test('requires the exact frame and origin and a well-formed Glide message', () => {
  const frame = {}, data = { type: 'glide:inline-text-edit' };
  const event = { source: frame, origin: 'http://localhost:7777', data };
  expect(trustedWindowMessage(event, frame, 'http://localhost:7777/proxy/')).toBe(true);
  expect(trustedWindowMessage({ ...event, source: {} }, frame, 'http://localhost:7777')).toBe(false);
  expect(trustedWindowMessage({ ...event, origin: 'https://evil.example' }, frame, 'http://localhost:7777')).toBe(false);
  for (const payload of [null, [], 'glide:edit', {}, { type: 'foreign' }]) expect(trustedWindowMessage({ ...event, data: payload }, frame, 'http://localhost:7777')).toBe(false);
  expect(trustedWindowMessage(event, frame, '')).toBe(false);
});

test('the served shell and both bridge paths embed the same boundary check', () => {
  for (const code of [getEditorHTML(), buildBridgeScript('data-gl-source', 'data-hover', 'data-selected', 8), buildGlideBridgeInlineScript(DEFAULT_CONFIG)]) {
    expect(code).toContain('event.source !== source');
    expect(code).toContain('event.origin !== origin');
  }
});
