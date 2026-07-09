/**
 * @srivarsank/core — Centralized Glide configuration.
 * Single source of truth for every value that used to be hardcoded.
 */

export interface GlideEditorTheme {
  accentColor: string;
  bgCanvas: string;
  bgPanel: string;
  borderColor: string;
  fontFamily: string;
}

export interface GlideViewport {
  width: number;
  height: number;
}

export interface GlideConfig {
  // Server
  port: number;
  targetPort: number;
  // Behavior
  historyLimit: number;
  selfWriteDebounceMs: number;
  // Snap engine (browser bridge)
  snapThresholdPx: number;
  maxGapDetection: number;
  maxDistanceIndicator: number;
  // DOM attributes (namespaceable)
  sourceAttribute: string;
  hoverAttribute: string;
  selectedAttribute: string;
  // Editor UI
  editorTheme: GlideEditorTheme;
  // Canvas defaults
  defaultViewport: GlideViewport;
  sidebarWidth: number;
}

export const DEFAULT_CONFIG: GlideConfig = {
  port: 7777,
  targetPort: 5173,
  historyLimit: 100,
  selfWriteDebounceMs: 3000,
  snapThresholdPx: 4,
  maxGapDetection: 500,
  maxDistanceIndicator: 120,
  sourceAttribute: 'data-gl-source',
  hoverAttribute: 'data-glide-hover',
  selectedAttribute: 'data-glide-selected',
  editorTheme: {
    accentColor: '#0c8ce9',
    bgCanvas: '#1e1e1e',
    bgPanel: '#2c2c2c',
    borderColor: '#333333',
    fontFamily: "'Inter', sans-serif",
  },
  defaultViewport: { width: 1440, height: 1024 },
  sidebarWidth: 260,
};

/** Deep-partial so nested overrides (e.g. just editorTheme.accentColor) work. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Merge user overrides onto DEFAULT_CONFIG. Nested objects are merged one
 * level deep so a partial theme override doesn't wipe the other tokens.
 */
export function resolveConfig(overrides?: DeepPartial<GlideConfig>): GlideConfig {
  if (!overrides) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    editorTheme: {
      ...DEFAULT_CONFIG.editorTheme,
      ...(overrides.editorTheme ?? {}),
    },
    defaultViewport: {
      ...DEFAULT_CONFIG.defaultViewport,
      ...(overrides.defaultViewport ?? {}),
    },
  };
}
