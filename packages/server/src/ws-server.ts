import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import * as fs from 'fs';
import { getEditorHTML } from '@glide-dev/overlay';
import { buildComponentTree } from '@glide-dev/core';
import * as path from 'path';
import chokidar from 'chokidar';
import { reorderJSXElement, insertJSXElement, groupJSXElements, ungroupJSXElement, arrangeJSXElement } from '@glide-dev/ast-writer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HistoryManager } from './undo-manager.js';
import {
  pushHistory,
  undo,
  redo,
  jumpTo,
  getHistoryState,
  clearHistory,
  setHistoryLimit
} from './history-manager.js';


const execAsync = promisify(exec);


export interface EditChange {
  type: 'style' | 'class' | 'text' | 'multi-class' | 'position' | 'group' | 'ungroup';
  property?: string;
  value?: any;
  sources?: string[];
  source?: string;
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
  change: EditChange,
  hash?: string
) => void | Promise<void>;

export class GlideServer {
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private port: number;
  private targetPort: number;
  private editCallbacks: EditCallback[] = [];
  private fileGenerations = new Map<string, number>();
  private watcher: any = null;
  private history = new HistoryManager();

  constructor(port = 7777, targetPort = 5173) {
    this.port = port;
    this.targetPort = targetPort;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        clearHistory();
        let limit = 100;
        const configPath = path.join(process.cwd(), 'glide.config.ts');
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          const match = content.match(/historyLimit\s*:\s*(\d+)/);
          if (match) {
            limit = parseInt(match[1], 10);
          }
        }
        setHistoryLimit(limit);

        this.server = createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getEditorHTML(this.targetPort));
        });


        // Start file watcher for drift detection
        const srcPath = path.resolve(process.cwd(), 'src');
        this.watcher = chokidar.watch(srcPath, { persistent: true });
        this.watcher.on('change', (filePath: string) => {
          const normPath = filePath.replace(/\\/g, '/');
          this.fileGenerations.set(normPath, (this.fileGenerations.get(normPath) || 0) + 1);
          console.log(`[Glide] File drift detected on ${normPath}, bumping generation counter to ${this.fileGenerations.get(normPath)}`);
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
                  const normPath = path.resolve(file).replace(/\\/g, '/');
                  ws.send(JSON.stringify({
                    type: 'tree',
                    file,
                    tree,
                    generation: this.fileGenerations.get(normPath) || 0
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
                    pushHistory({
                      description: `Inserted ${elementType} in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
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
                    pushHistory({
                      description: `Reordered elements in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
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
                    pushHistory({
                      description: `Grouped elements in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
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
                    pushHistory({
                      description: `Ungrouped element in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
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
                    pushHistory({
                      description: `Arranged element in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
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


              if (message.type === 'git-branch-create') {
                const { branchName } = message;
                console.log(`[Glide] Creating and checking out git branch: ${branchName}`);
                try {
                  await execAsync(`git checkout -b ${branchName}`);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: true,
                    branch: branchName,
                    action: 'create'
                  }));
                } catch (err: any) {
                  console.error(`[Glide] Failed to create git branch ${branchName}:`, err.message);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: err.message,
                    action: 'create'
                  }));
                }
                return;
              }

              if (message.type === 'git-branch-finalize') {
                const { commitMessage } = message;
                console.log(`[Glide] Finalizing git branch with commit: "${commitMessage}"`);
                try {
                  await execAsync(`git add -A && git commit -m "${commitMessage}"`);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: true,
                    action: 'finalize'
                  }));
                } catch (err: any) {
                  console.error(`[Glide] Failed to finalize git branch:`, err.message);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: err.message,
                    action: 'finalize'
                  }));
                }
                return;
              }

              if (message.type === 'undo' || message.type === 'UNDO') {
                console.log('[Glide] Undo request received');
                try {
                  const diffs = undo();
                  if (diffs && diffs.length > 0) {
                    for (const diff of diffs) {
                      fs.writeFileSync(diff.file, diff.before, 'utf-8');
                      // Push updated tree
                      const updatedCode = fs.readFileSync(diff.file, 'utf-8');
                      const tree = buildComponentTree(updatedCode);
                      ws.send(JSON.stringify({
                        type: 'tree',
                        file: diff.file,
                        tree
                      }));
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: true,
                    message: 'Undo successful',
                    action: 'undo'
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'redo' || message.type === 'REDO') {
                console.log('[Glide] Redo request received');
                try {
                  const diffs = redo();
                  if (diffs && diffs.length > 0) {
                    for (const diff of diffs) {
                      fs.writeFileSync(diff.file, diff.after, 'utf-8');
                      // Push updated tree
                      const updatedCode = fs.readFileSync(diff.file, 'utf-8');
                      const tree = buildComponentTree(updatedCode);
                      ws.send(JSON.stringify({
                        type: 'tree',
                        file: diff.file,
                        tree
                      }));
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: true,
                    message: 'Redo successful',
                    action: 'redo'
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'JUMP_TO_HISTORY') {
                console.log('[Glide] Jump to history index:', message.index);
                try {
                  const writes = jumpTo(message.index);
                  for (const w of writes) {
                    fs.writeFileSync(w.file, w.content, 'utf-8');
                    // Push updated tree
                    const tree = buildComponentTree(w.content);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file: w.file,
                      tree
                    }));
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'GET_HISTORY') {
                ws.send(JSON.stringify({
                  type: 'HISTORY_UPDATE',
                  ...getHistoryState()
                }));
                return;
              }


              if (message.type === 'edit') {
                const { file, line, column, change, hash, generation } = message as any;
                console.log(`[Glide] Edit request: ${change?.type} at ${file}:${line}:${column} (hash: ${hash}, gen: ${generation})`);

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

                // Invalidate on drift check
                const normPath = path.resolve(file).replace(/\\/g, '/');
                const currentGen = this.fileGenerations.get(normPath) || 0;
                if (generation !== undefined && generation !== currentGen) {
                  ws.send(
                    JSON.stringify({
                      type: 'status',
                      success: false,
                      error: `STALE_GENERATION: File has drifted since selection (expected generation ${generation}, current is ${currentGen})`,
                    })
                  );
                  return;
                }

                // Call registered edit callbacks
                for (const callback of this.editCallbacks) {
                  try {
                    await callback(file, line, column, change, hash);
                  } catch (err: any) {
                    console.error(`[Glide] Edit handler error:`, err.message);
                    ws.send(
                      JSON.stringify({
                        type: 'status',
                        success: false,
                        error: err.message,
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

                ws.send(JSON.stringify({
                  type: 'HISTORY_UPDATE',
                  ...getHistoryState()
                }));
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
