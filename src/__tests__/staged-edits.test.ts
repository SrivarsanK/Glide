import { describe, expect, test, afterEach } from 'vitest';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import WebSocket from 'ws';
import type { StagedPatch, StagedEditSet, BatchEditMessage } from '../../packages/core/src/staged-edits.js';

describe('Staged Edits & Batch Protocol', () => {
  let server: GlideServer | null = null;
  const testPort = 7891;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test('should buffer and serialize staged edits correctly', () => {
    const staged = new Map<string, StagedPatch[]>();
    const source1 = 'src/App.tsx:14:5';
    const source2 = 'src/App.tsx:28:9';

    const patch1: StagedPatch = {
      sourceId: source1,
      property: 'backgroundColor',
      value: '#38bdf8',
      previousValue: '#ffffff',
      timestamp: Date.now()
    };
    const patch2: StagedPatch = {
      sourceId: source1,
      property: 'paddingTop',
      value: '24px',
      timestamp: Date.now()
    };
    const patch3: StagedPatch = {
      sourceId: source2,
      property: 'fontSize',
      value: '18px',
      timestamp: Date.now()
    };

    staged.set(source1, [patch1, patch2]);
    staged.set(source2, [patch3]);

    let totalCount = 0;
    const batchEdits: BatchEditMessage['edits'] = [];

    staged.forEach((patches) => {
      totalCount += patches.length;
      for (const p of patches) {
        const parts = p.sourceId.split(':');
        batchEdits.push({
          file: parts[0],
          line: parseInt(parts[1], 10),
          column: parseInt(parts[2], 10),
          change: {
            type: 'class',
            property: p.property,
            value: p.value
          }
        });
      }
    });

    expect(totalCount).toBe(3);
    expect(batchEdits).toHaveLength(3);
    expect(batchEdits[0].file).toBe('src/App.tsx');
    expect(batchEdits[0].line).toBe(14);
    expect(batchEdits[0].change.property).toBe('backgroundColor');
    expect(batchEdits[2].line).toBe(28);
    expect(batchEdits[2].change.property).toBe('fontSize');
  });

  test('server accepts batch-edit payload and executes all edits with shared batchSquashKey', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const receivedEdits: any[] = [];
    server.onEdit((file, line, column, change) => {
      receivedEdits.push({ file, line, column, change });
    });

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    const batchMsg: BatchEditMessage = {
      type: 'batch-edit',
      batchId: 'batch-test-123',
      edits: [
        {
          file: 'src/App.tsx',
          line: 10,
          column: 2,
          change: { type: 'class', property: 'backgroundColor', value: '#ff0000' }
        },
        {
          file: 'src/App.tsx',
          line: 15,
          column: 4,
          change: { type: 'class', property: 'color', value: '#00ff00' }
        }
      ]
    };

    client.send(JSON.stringify(batchMsg));

    const statusResponse = await new Promise<string>((resolve) => {
      client.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status') resolve(data.toString());
      });
    });

    const statusObj = JSON.parse(statusResponse);
    expect(statusObj.success).toBe(true);
    expect(statusObj.action).toBe('batch-edit');
    expect(statusObj.count).toBe(2);

    expect(receivedEdits).toHaveLength(2);
    expect(receivedEdits[0].change.batchSquashKey).toBe('batch-test-123');
    expect(receivedEdits[1].change.batchSquashKey).toBe('batch-test-123');

    client.close();
  });

  test('server rejects empty batch-edit payload cleanly', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    client.send(JSON.stringify({ type: 'batch-edit', edits: [] }));

    const response = await new Promise<string>((resolve) => {
      client.on('message', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Empty');

    client.close();
  });
});
