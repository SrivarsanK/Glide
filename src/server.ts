import { WebSocketServer, WebSocket } from 'ws';

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
  private port: number;
  private editCallbacks: EditCallback[] = [];

  constructor(port = 7777) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port }, () => {
          resolve();
        });

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
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.wss = null;
          resolve();
        }
      });
    });
  }

  public onEdit(callback: EditCallback): void {
    this.editCallbacks.push(callback);
  }
}
