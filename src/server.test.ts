import { describe, expect, test, afterEach } from 'vitest';
import { GlideServer, EditMessage } from './server.js';
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
});
