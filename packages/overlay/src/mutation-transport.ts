interface Mapping {
  parse(source: unknown, currentFile?: string | null): { file: string; line: number; column: number; hash: string | null } | null;
  remap(source: string, remaps: any[], currentFile?: string | null): string;
}
interface TransportOptions {
  send(data: string): void;
  digest(file: string): string | undefined;
  currentFile(): string | null;
  id(): string;
  error(message: string): void;
  rejected?(transactionId: string): void;
  mapping: Mapping;
}

/** Self-contained browser migration boundary for every served mutation control. */
export function createMutationTransport(options: TransportOptions) {
  type Request = { id: string; message: any; history: boolean };
  let active: Request | null = null;
  const queue: Request[] = [];
  let ready = false;
  const structural = ['insert', 'reorder', 'reparent', 'group', 'ungroup', 'arrange'];
  const history = ['undo', 'UNDO', 'redo', 'REDO', 'JUMP_TO_HISTORY'];
  function cancelQueue() {
    for (const request of queue.splice(0)) options.rejected?.(request.id);
  }
  function transmit() {
    if (!ready) return;
    if (!active) active = queue.shift() || null;
    if (active) options.send(JSON.stringify(active.message));
  }
  function send(payload: string): void {
    const message = JSON.parse(payload);
    if (!['edit', 'batch-edit', ...structural, ...history].includes(message.type)) {
      options.send(payload);
      return;
    }
    try {
      if (history.includes(message.type)) {
        if (active || queue.length) throw new Error('Wait for source changes before changing history.');
        const id = message.transactionId || options.id();
        queue.push({ id, history: true, message: { ...message, transactionId: id } });
      } else {
        if (active?.history) throw new Error('Wait for history restoration before editing.');
        let edits = message.type === 'batch-edit' ? message.edits : [message];
        if (structural.includes(message.type)) {
          const source = message.type === 'insert' ? message.parentId : message.type === 'group' ? message.selectedIds?.[0]
            : message.sourceId || message.targetId || message.groupId;
          const parsed = options.mapping.parse(source, message.file || options.currentFile());
          if (!parsed) throw new Error('Select an authored source target before changing structure.');
          edits = [{ ...parsed, change: { ...message, parentId: message.newParentId || message.parentId, sources: message.selectedIds } }];
        }
        if (!Array.isArray(edits) || !edits.length) throw new Error('No source changes to apply.');
        const id = message.batchId || message.transactionId || options.id();
        if (active?.id === id) { transmit(); return; }
        if (queue.some(item => item.id === id)) return;
        const captured = edits.map((edit: any, index: number) => {
          const file = edit.file || options.currentFile();
          const digest = edit.expectedDigest || (file && options.digest(file));
          if (!digest) throw new Error('Source mapping is not ready. Select the element again.');
          return { ...edit, file, expectedDigest: digest, operationId: edit.operationId || `${id}:${index}` };
        });
        queue.push({ id, history: false, message: { type: 'batch-edit', batchId: id, edits: captured } });
      }
      if (!active) transmit();
    } catch (error) {
      const id = message.batchId || message.transactionId;
      if (id) options.rejected?.(id);
      options.error(error instanceof Error ? error.message : String(error));
    }
  }
  function accept(message: any): void {
    if (message.type !== 'status' || !active || message.transactionId !== active.id) return;
    const completed = active;
    active = null;
    if (!message.success) {
      if (queue.length) options.error('Queued live changes were cancelled after a source conflict. Select the element again.');
      cancelQueue();
      return;
    }
    const remaps = message.selectionRemaps || [];
    const deleted = new Set(message.deletedSourceIds || []);
    try {
      for (const request of queue) for (const edit of request.message.edits || []) {
        const prior = completed.message.edits?.find((item: any) => item.file === edit.file);
        if (!prior || edit.expectedDigest !== prior.expectedDigest) continue;
        const mapReference = (source: string) => {
          const parsed = options.mapping.parse(source, edit.file);
          if (!parsed) throw new Error('The queued target could not be remapped safely.');
          const id = `${parsed.file}:${parsed.line}:${parsed.column}`;
          if (deleted.has(id)) throw new Error('The queued target was deleted. Select another element.');
          const remap = remaps.find((item: any) => item.oldSourceId === id
            && (!parsed.hash || parsed.hash === item.oldHash));
          if (!remap) throw new Error('The queued target could not be remapped safely.');
          return { source: options.mapping.remap(source, remaps, edit.file), remap };
        };
        const source = `${edit.file}:${edit.line}:${edit.column}${edit.hash ? ':' + edit.hash : ''}`;
        const { source: updatedSource, remap } = mapReference(source);
        const mapped = options.mapping.parse(updatedSource)!;
        edit.line = mapped.line; edit.column = mapped.column; edit.hash = mapped.hash;
        edit.expectedDigest = remap.newDigest;
        for (const key of ['source', 'parentId', 'siblingId']) {
          if (edit.change[key]) edit.change[key] = mapReference(edit.change[key]).source;
        }
        if (edit.change.sources) edit.change.sources = edit.change.sources.map((ref: string) => mapReference(ref).source);
      }
    } catch (error) {
      cancelQueue();
      options.error(error instanceof Error ? error.message : String(error));
    }
    transmit();
  }
  return { send, accept, connected() { ready = true; transmit(); }, disconnected() { ready = false; },
    pending() { return (active ? 1 : 0) + queue.length; } };
}
