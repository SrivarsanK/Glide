/**
 * Shared types for the Glide visual editor.
 * All packages import types from @glide-dev/core.
 */

// ── Scene Graph Types ──────────────────────────────────────────────────

export interface GlideNode {
  id: string;               // data-gl-source value e.g. "src/Card.jsx:24:5"
  tagName: string;           // lowercase: 'div', 'p', 'button'
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
  children: string[];        // child node ids
  parentId: string | null;
  componentName: string | null;
  componentFile: string | null;
  isComponentRoot?: boolean;
}

// ── Component Tree Types ───────────────────────────────────────────────

export interface ComponentTreeNode {
  id: string;
  name: string;
  className?: string;
  text?: string;
  children: ComponentTreeNode[];
}

// ── Edit Message Types ─────────────────────────────────────────────────

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

// ── Style Change Types ─────────────────────────────────────────────────

export interface StyleChange {
  property: string;    // camelCase CSS property e.g. "marginLeft"
  value: string | number;
  unit?: 'px' | 'rem' | '%' | 'em';
}

// ── Framework Types ────────────────────────────────────────────────────

export type FrameworkId = 'react' | 'vue' | 'svelte' | 'astro' | 'html' | 'unknown';
export type MetaFrameworkId = 'next' | 'nuxt' | 'astro' | 'none';
export type StylingMode = 'tailwind' | 'styled-components' | 'emotion' | 'stitches' | 'cssmodules' | 'unocss' | 'css';

export interface ProjectMeta {
  framework: FrameworkId;
  metaFramework: MetaFrameworkId;
  srcDir: string;
}

// ── Overlay Types ──────────────────────────────────────────────────────

export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ── WebSocket Protocol ─────────────────────────────────────────────────

export interface StyleChangeMessage {
  type: 'STYLE_CHANGE';
  file: string;
  line: number;
  col: number;
  change: StyleChange;
  viewportWidth: number;
}

export interface ReorderMessage {
  type: 'REORDER_CHILDREN';
  file: string;
  parentLine: number;
  parentCol: number;
  fromIndex: number;
  toIndex: number;
}

export interface UndoMessage {
  type: 'UNDO';
}

export interface RedoMessage {
  type: 'REDO';
}

export interface AckMessage {
  type: 'ACK';
  success: boolean;
  error?: string;
}

export interface OpenFileMessage {
  type: 'OPEN_FILE';
  file: string;
  line: number;
}

// ── Toast Types ────────────────────────────────────────────────────────

export interface ToastMessage {
  type: 'success' | 'error';
  file: string;
  change: string;
  hmr: boolean;
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  diffs: FileDiff[];
}

export interface JumpToHistoryMessage {
  type: 'JUMP_TO_HISTORY';
  index: number;
}

export interface GetHistoryMessage {
  type: 'GET_HISTORY';
}

export interface HistoryUpdateMessage {
  type: 'HISTORY_UPDATE';
  stack: HistoryEntry[];
  currentIndex: number;
}

