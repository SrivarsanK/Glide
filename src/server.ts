import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';

export interface EditChange {
  type: 'style' | 'class';
  property: string;
  value: any;
}

export interface EditMessage {
  type: 'edit';
  file: string;
  line: number;
  column: number;
  change: EditChange;
}

export type EditCallback = (
  file: string,
  line: number,
  column: number,
  change: EditChange
) => void | Promise<void>;

export class GlideServer {
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private port: number;
  private editCallbacks: EditCallback[] = [];

  constructor(port = 7777) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Glide Development Server</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc; text-align: center; }
                  h1 { color: #38bdf8; margin-bottom: 24px; }
                  code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f472b6; }
                  ol { text-align: left; display: inline-block; margin: 20px auto; }
                  li { margin-bottom: 10px; }
                  .badge { display: inline-block; padding: 6px 12px; background: #0369a1; color: #e0f2fe; border-radius: 9999px; font-weight: bold; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <h1>Glide Visual Workspace Server</h1>
                <div class="badge">WebSocket Server Port: ${this.port}</div>
                <p>This is the Glide WebSocket server running successfully.</p>
                <p>To use the visual canvas editor, do not open this URL directly. Instead:</p>
                <ol>
                  <li>Open your target application's local dev server URL (e.g. <code>http://localhost:4321</code>).</li>
                  <li>The visual editor overlay will render directly on top of your running application!</li>
                </ol>
              </body>
            </html>
          `);
        });

        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket) => {
          ws.on('message', async (data: string) => {
            try {
              const message = JSON.parse(data);

              if (message.type === 'edit') {
                const { file, line, column, change } = message as EditMessage;

                // Validate parameters
                if (!file || typeof line !== 'number' || typeof column !== 'number' || !change) {
                  ws.send(
                    JSON.stringify({
                      type: 'status',
                      success: false,
                      error: 'Invalid edit payload',
                    })
                  );
                  return;
                }

                // Call registered edit callbacks
                for (const callback of this.editCallbacks) {
                  try {
                    await callback(file, line, column, change);
                  } catch (err: any) {
                    ws.send(
                      JSON.stringify({
                        type: 'status',
                        success: false,
                        error: `Handler error: ${err.message}`,
                      })
                    );
                    return;
                  }
                }

                ws.send(
                  JSON.stringify({
                    type: 'status',
                    success: true,
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `Unsupported message type: ${message.type}`,
                  })
                );
              }
            } catch (err: any) {
              ws.send(
                JSON.stringify({
                  type: 'status',
                  success: false,
                  error: `Malformed JSON: ${err.message}`,
                })
              );
            }
          });
        });

        this.wss.on('error', (err) => {
          reject(err);
        });

        this.server.listen(this.port, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss) {
        this.wss.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          this.wss = null;
          this.closeHttpServer(resolve, reject);
        });
      } else {
        this.closeHttpServer(resolve, reject);
      }
    });
  }

  private closeHttpServer(resolve: () => void, reject: (err: Error) => void) {
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  }

  public onEdit(callback: EditCallback): void {
    this.editCallbacks.push(callback);
  }
}
