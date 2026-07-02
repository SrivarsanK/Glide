import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import * as fs from 'fs';
import { getEditorHTML } from './editor-html.js';
import { buildComponentTree } from './tree.js';
import { reorderJSXElement, insertJSXElement, groupJSXElements, ungroupJSXElement, arrangeJSXElement } from './reorder.js';

export interface EditChange {
  type: 'style' | 'class' | 'text' | 'multi-class';
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
  private targetPort: number;
  private editCallbacks: EditCallback[] = [];

  constructor(port = 7777, targetPort = 5173) {
    this.port = port;
    this.targetPort = targetPort;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getEditorHTML(this.targetPort));
        });

        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket) => {
          ws.on('message', async (data: string) => {
            try {
              const message = JSON.parse(data);

              if (message.type === 'get-tree') {
                const { file } = message;
                if (fs.existsSync(file)) {
                  const code = fs.readFileSync(file, 'utf-8');
                  const tree = buildComponentTree(code);
                  ws.send(JSON.stringify({
                    type: 'tree',
                    file,
                    tree
                  }));
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'insert') {
                const { file, parentId, elementType } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = insertJSXElement(code, parentId, elementType);
                    fs.writeFileSync(file, updated, 'utf-8');
                    // Automatically send updated tree back
                    const tree = buildComponentTree(updated);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'reorder') {
                const { file, targetId, parentId, siblingId, position } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = reorderJSXElement(code, targetId, parentId, siblingId, position);
                    fs.writeFileSync(file, updated, 'utf-8');
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: true
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'group') {
                const { file, selectedIds } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = groupJSXElements(code, selectedIds);
                    fs.writeFileSync(file, updated, 'utf-8');
                    const tree = buildComponentTree(updated);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'ungroup') {
                const { file, groupId } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = ungroupJSXElement(code, groupId);
                    fs.writeFileSync(file, updated, 'utf-8');
                    const tree = buildComponentTree(updated);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'arrange') {
                const { file, targetId, action } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = arrangeJSXElement(code, targetId, action);
                    fs.writeFileSync(file, updated, 'utf-8');
                    const tree = buildComponentTree(updated);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'edit') {
                const { file, line, column, change } = message as EditMessage;
                console.log(`[Glide] Edit request: ${change?.type} at ${file}:${line}:${column}`);

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
                    console.error(`[Glide] Edit handler error:`, err.message);
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
