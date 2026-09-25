import { describe, expect, test, afterEach } from 'vitest';
import { GlideServer, EditMessage } from '../../packages/server/src/ws-server.js';
import WebSocket from 'ws';

describe('GlideServer WebSocket Server', () => {
  let server: GlideServer | null = null;
  const testPort = 7890;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test('should start and stop successfully', async () => {
    server = new GlideServer(testPort);
    await expect(server.start()).resolves.toBeUndefined();
    await expect(server.stop()).resolves.toBeUndefined();
    server = null;
  });

  test('should accept connection and receive edit payload', async () => {
    server = new GlideServer(testPort);
    await server.start();

    let receivedEdit: any = null;
    server.onEdit((file, line, column, change) => {
      receivedEdit = { file, line, column, change };
    });

    const client = new WebSocket(`ws://localhost:${testPort}`);

    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    const payload: EditMessage = {
      type: 'edit',
      file: 'src/App.tsx',
      line: 12,
      column: 3,
      change: {
        type: 'class',
        property: 'className',
        value: 'ml-4',
      },
    };

    client.send(JSON.stringify(payload));

    const response = await new Promise<string>((resolve) => {
      client.on('message', (data) => {
        resolve(data.toString());
      });
    });

    const resObj = JSON.parse(response);
    expect(resObj.success).toBe(true);
    expect(receivedEdit).not.toBeNull();
    expect(receivedEdit.file).toBe('src/App.tsx');
    expect(receivedEdit.line).toBe(12);
    expect(receivedEdit.column).toBe(3);
    expect(receivedEdit.change.value).toBe('ml-4');

    client.close();
  });

  test('should reject malformed JSON', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    client.send('invalid json');

    const response = await new Promise<string>((resolve) => {
      client.on('message', (data) => {
        resolve(data.toString());
      });
    });

    const resObj = JSON.parse(response);
    expect(resObj.success).toBe(false);
    expect(resObj.error).toContain('Malformed JSON');

    client.close();
  });

  test('should reject invalid payload parameters', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    client.send(JSON.stringify({ type: 'edit', file: '', line: 'not a number' }));

    const response = await new Promise<string>((resolve) => {
      client.on('message', (data) => {
        resolve(data.toString());
      });
    });

    const resObj = JSON.parse(response);
    expect(resObj.success).toBe(false);
    expect(resObj.error).toContain('Invalid edit payload');

    client.close();
  });

  test('should accept connection and receive group and ungroup edit payloads', async () => {
    server = new GlideServer(testPort);
    await server.start();

    let receivedEdit: any = null;
    server.onEdit((file, line, column, change) => {
      receivedEdit = { file, line, column, change };
    });

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    // 1. Send Group Payload
    const groupPayload = {
      type: 'edit',
      file: 'src/App.tsx',
      line: 12,
      column: 3,
      change: {
        type: 'group',
        sources: ['src/App.tsx:12:3', 'src/App.tsx:13:3'],
      },
    };

    client.send(JSON.stringify(groupPayload));

    const groupResponse = await new Promise<string>((resolve) => {
      client.once('message', (data) => {
        resolve(data.toString());
      });
    });

    let resObj = JSON.parse(groupResponse);
    expect(resObj.success).toBe(true);
    expect(receivedEdit).not.toBeNull();
    expect(receivedEdit.change.type).toBe('group');
    expect(receivedEdit.change.sources).toEqual(['src/App.tsx:12:3', 'src/App.tsx:13:3']);

    // 2. Send Ungroup Payload
    const ungroupPayload = {
      type: 'edit',
      file: 'src/App.tsx',
      line: 12,
      column: 3,
      change: {
        type: 'ungroup',
        source: 'src/App.tsx:12:3',
      },
    };

    client.send(JSON.stringify(ungroupPayload));

    const ungroupResponse = await new Promise<string>((resolve) => {
      client.once('message', (data) => {
        resolve(data.toString());
      });
    });

    resObj = JSON.parse(ungroupResponse);
    expect(resObj.success).toBe(true);
    expect(receivedEdit.change.type).toBe('ungroup');
    expect(receivedEdit.change.source).toBe('src/App.tsx:12:3');

    client.close();
  });

  test('should broadcast messages including scene_update to connected clients', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    const receivedMessages: any[] = [];
    client.on('message', (data) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    server.broadcast({
      type: 'scene_update',
      file: 'src/App.tsx',
      elements: [
        { id: 'src/App.tsx:10:5', tag: 'div', line: 10, col: 5 }
      ],
      generation: 2
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const updateMsg = receivedMessages.find((m) => m.type === 'scene_update');
    expect(updateMsg).toBeDefined();
    expect(updateMsg.file).toBe('src/App.tsx');
    expect(updateMsg.elements.length).toBe(1);
    expect(updateMsg.elements[0].id).toBe('src/App.tsx:10:5');
    expect(updateMsg.generation).toBe(2);

    client.close();
  });

  test('should handle reparent message and return status', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    const reparentPayload = {
      type: 'reparent',
      file: 'non-existent-file.tsx',
      sourceId: 'elem-1',
      newParentId: 'container-2',
      newIndex: 0
    };

    client.send(JSON.stringify(reparentPayload));

    const response = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });

    const resObj = JSON.parse(response);
    expect(resObj.type).toBe('status');
    expect(resObj.success).toBe(false);
    expect(resObj.error).toContain('File not found');

    client.close();
  });

  test('should handle resolve_component message and return resolved_component payload', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    // Test missing componentName error
    client.send(JSON.stringify({
      type: 'resolve_component',
      componentName: ''
    }));

    const response1 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });

    const res1 = JSON.parse(response1);
    expect(res1.type).toBe('resolved_component');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('componentName is required');

    client.close();
  });

  test('should handle open_component message and return open_component_status', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    client.send(JSON.stringify({
      type: 'open_component',
      file: 'non-existent-component.tsx',
      line: 10,
      column: 2
    }));

    const response = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });

    const resObj = JSON.parse(response);
    expect(resObj.type).toBe('open_component_status');
    expect(resObj.success).toBe(false);
    expect(resObj.error).toContain('File not found');

    client.close();
  });

  test('should enforce property-level LWW conflict resolution on incoming edits', async () => {
    server = new GlideServer(testPort);
    await server.start();

    server.onEdit(() => {});

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    const targetFile = 'src/App.tsx';

    // 1. Send first write with timestamp 2000
    client.send(JSON.stringify({
      type: 'edit',
      file: targetFile,
      line: 10,
      column: 5,
      timestamp: 2000,
      change: {
        type: 'style',
        value: { width: '200px' }
      }
    }));

    const resp1 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    const res1 = JSON.parse(resp1);
    expect(res1.success).toBe(true);
    expect(res1.properties).toContain('width');

    // 2. Send older write with timestamp 1500 to the same property -> should be rejected under LWW
    client.send(JSON.stringify({
      type: 'edit',
      file: targetFile,
      line: 10,
      column: 5,
      timestamp: 1500,
      change: {
        type: 'style',
        value: { width: '150px' }
      }
    }));

    const resp2 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    const res2 = JSON.parse(resp2);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('STALE_PROPERTY_WRITE');

    // 3. Send write to a DIFFERENT property on same node with timestamp 1500 -> should succeed (no conflict across properties!)
    client.send(JSON.stringify({
      type: 'edit',
      file: targetFile,
      line: 10,
      column: 5,
      timestamp: 1500,
      change: {
        type: 'style',
        value: { backgroundColor: '#ff0000' }
      }
    }));

    const resp3 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    const res3 = JSON.parse(resp3);
    expect(res3.success).toBe(true);
    expect(res3.properties).toContain('backgroundColor');

    client.close();
  });

  test('should handle GET_PENDING_OPS and ACK_OP messages', async () => {
    server = new GlideServer(testPort);
    await server.start();

    const client = new WebSocket(`ws://localhost:${testPort}`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    // Request pending ops stats
    client.send(JSON.stringify({ type: 'GET_PENDING_OPS' }));
    const resp1 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    const res1 = JSON.parse(resp1);
    expect(res1.type).toBe('PENDING_OPS');
    expect(typeof res1.pendingCount).toBe('number');

    // Enqueue a pending op directly on server queue and ack it via WS
    const q = server.getDeltaQueue();
    const opId = q.enqueuePending('node-test', 'opacity', 0.5);

    client.send(JSON.stringify({
      type: 'ACK_OP',
      opId
    }));

    const resp2 = await new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    const res2 = JSON.parse(resp2);
    expect(res2.type).toBe('ACK_OP_STATUS');
    expect(res2.success).toBe(true);
    expect(res2.opId).toBe(opId);

    client.close();
  });
});
