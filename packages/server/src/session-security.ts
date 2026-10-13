import type { IncomingMessage } from 'node:http';

export interface RemoteAccess {
  bindAddress: string;
  allowedHosts: string[];
  allowedOrigins: string[];
}

export function trustedRequest(req: IncomingMessage, port: number, remote?: RemoteAccess): boolean {
  const host = req.headers.host;
  const hosts = remote?.allowedHosts ?? [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
  if (!host || !hosts.includes(host.toLowerCase())) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  return (remote?.allowedOrigins ?? [`http://${host}`]).includes(origin);
}

export function validateMessage(value: unknown): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof (value as any).type !== 'string' || (value as any).type.length > 64) {
    throw new Error('INVALID_MESSAGE: A message needs an object and a type.');
  }
  const inspect = (item: unknown, depth: number): void => {
    if (depth > 16) throw new Error('INVALID_MESSAGE: The message is too deeply nested.');
    if (!item || typeof item !== 'object') return;
    if (Object.keys(item).length > 1000) throw new Error('INVALID_MESSAGE: The message has too many items.');
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('INVALID_MESSAGE: Reserved property name.');
      inspect(child, depth + 1);
    }
  };
  inspect(value, 0);
}
