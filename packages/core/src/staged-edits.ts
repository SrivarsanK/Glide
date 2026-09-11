/**
 * Staged Edits Buffer types for Glide Design Mode.
 * Enables in-memory style overrides with instant DOM preview,
 * before-and-after visual diffing, and batch disk commits.
 */

export interface StagedPatch {
  sourceId: string;
  property: string;
  value: string;
  previousValue?: string;
  timestamp: number;
}

export interface StagedEditSet {
  patches: Map<string, StagedPatch[]>;
  createdAt: number;
}

export interface PreviewStyleMessage {
  type: 'glide:preview-style';
  sourceId: string;
  styles: Record<string, string>;
}

export interface ClearPreviewMessage {
  type: 'glide:clear-preview';
  sourceId?: string;
}

export interface BatchEditItem {
  file: string;
  line: number;
  column: number;
  hash?: string;
  selector?: string | null;
  change: {
    type: string;
    property?: string;
    value: any;
    batchSquashKey?: string;
    batchDescription?: string;
  };
}

export interface BatchEditMessage {
  type: 'batch-edit';
  batchId?: string;
  edits: BatchEditItem[];
}
