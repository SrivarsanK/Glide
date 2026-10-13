import WebSocket from 'ws';

export async function connectLocal(port: number): Promise<WebSocket> {
  const origin = `http://127.0.0.1:${port}`;
  const html = await (await fetch(origin)).text();
  const token = html.match(/type: 'hello', token: "([a-f0-9]+)"/)?.[1];
  if (!token) throw new Error('The editor shell has no session token.');
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const reply = new Promise<void>((resolve, reject) => ws.once('message', data => {
    if (JSON.parse(String(data)).type === 'authenticated') resolve();
    else reject(new Error('Session authentication failed.'));
  }));
  ws.send(JSON.stringify({ type: 'hello', token }));
  await reply;
  return ws;
}
