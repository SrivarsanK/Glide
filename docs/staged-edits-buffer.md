# Staged Edits Buffer Specification

The Staged Edits Buffer provides an in-memory preview layer between visual property changes in the Glide editor and disk writes. Edits render immediately in the canvas via direct DOM style overrides without triggering Vite Hot Module Replacement (HMR) or file writes until explicit commit.

## Architecture

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 260" width="100%" height="260" style="background:#0f172a; border-radius:8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Step 1: Design Panel -->
  <g transform="translate(40, 40)" filter="url(#shadow)">
    <rect width="180" height="90" rx="8" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="20" y="34" fill="#38bdf8" font-size="12" font-weight="700" letter-spacing="0.5">DESIGN PANEL</text>
    <text x="20" y="58" fill="#e2e8f0" font-size="14" font-weight="600">Property Change</text>
    <text x="20" y="76" fill="#94a3b8" font-size="11">Color, layout, spacing, text</text>
  </g>

  <!-- Arrow 1 -->
  <path d="M 220 85 L 280 85" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
  <polygon points="280,85 272,80 272,90" fill="#38bdf8"/>
  <text x="232" y="75" fill="#94a3b8" font-size="10" text-anchor="middle">stage</text>

  <!-- Step 2: Staged Edits Buffer -->
  <g transform="translate(290, 40)" filter="url(#shadow)">
    <rect width="210" height="90" rx="8" fill="url(#panelGrad)" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="20" y="34" fill="#38bdf8" font-size="12" font-weight="700" letter-spacing="0.5">IN-MEMORY BUFFER</text>
    <text x="20" y="58" fill="#ffffff" font-size="14" font-weight="600">Map&lt;sourceId, Patches&gt;</text>
    <text x="20" y="76" fill="#94a3b8" font-size="11">Deduplicates by CSS property</text>
  </g>

  <!-- Split Branch to Preview (Up/Right) -->
  <path d="M 500 70 L 570 70 L 570 50 L 610 50" stroke="#38bdf8" stroke-width="2" fill="none"/>
  <polygon points="610,50 602,45 602,55" fill="#38bdf8"/>
  <text x="555" y="42" fill="#38bdf8" font-size="10" text-anchor="middle">postMessage</text>

  <!-- Step 3A: Iframe Bridge Preview -->
  <g transform="translate(620, 15)" filter="url(#shadow)">
    <rect width="220" height="70" rx="8" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="16" y="28" fill="#2dd4bf" font-size="11" font-weight="700">CANVAS DOM PREVIEW</text>
    <text x="16" y="48" fill="#e2e8f0" font-size="12" font-weight="500">element.style overrides</text>
    <text x="16" y="62" fill="#64748b" font-size="10">Zero reload, instant feedback</text>
  </g>

  <!-- Split Branch to Apply / Discard (Down/Right) -->
  <path d="M 500 100 L 570 100 L 570 145 L 610 145" stroke="#f43f5e" stroke-width="2" fill="none"/>
  <polygon points="610,145 602,140 602,150" fill="#f43f5e"/>
  <text x="555" y="135" fill="#f43f5e" font-size="10" text-anchor="middle">Apply Click</text>

  <!-- Step 3B: WebSocket Server Batch Write -->
  <g transform="translate(620, 110)" filter="url(#shadow)">
    <rect width="220" height="70" rx="8" fill="url(#panelGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="16" y="28" fill="#f43f5e" font-size="11" font-weight="700">WEBSOCKET SERVER</text>
    <text x="16" y="48" fill="#e2e8f0" font-size="12" font-weight="500">batch-edit message</text>
    <text x="16" y="62" fill="#64748b" font-size="10">Squashed single history entry</text>
  </g>

  <!-- Step 4: Staging Bar Controls Footer -->
  <g transform="translate(230, 180)">
    <rect width="420" height="48" rx="24" fill="#1e293b" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1"/>
    <circle cx="260" cy="204" r="4" fill="#38bdf8"/>
    <text x="272" y="208" fill="#38bdf8" font-size="12" font-weight="600">N changes staged</text>
    <rect x="385" y="190" width="70" height="28" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>
    <text x="420" y="208" fill="#e2e8f0" font-size="11" text-anchor="middle">Before/After</text>
    <rect x="465" y="190" width="65" height="28" rx="14" fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.3)"/>
    <text x="497" y="208" fill="#fb7185" font-size="11" text-anchor="middle">Discard</text>
    <rect x="540" y="190" width="95" height="28" rx="14" fill="#38bdf8"/>
    <text x="587" y="208" fill="#0f172a" font-size="11" font-weight="700" text-anchor="middle">Apply Changes</text>
  </g>
</svg>

## Data Structures

The staging system is defined in `packages/core/src/staged-edits.ts`:

```typescript
export interface StagedPatch {
  sourceId: string;
  property: string;
  value: string;
  previousValue?: string;
  timestamp: number;
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
```

## Lifecycle Flow

1. **User Edit**:
   Changing a property in the Design Panel dispatches `sendEdit(change)` or `sendMultiClassChange(source, styles)`.
2. **Buffer Interception**:
   When `stagingModeActive` is true, the edit is added to `stagedEdits` Map (`sourceId` -> `property` -> patch).
   The floating Staging Bar appears with the pending change count.
3. **Instant Preview**:
   A `glide:preview-style` message is sent to the preview iframe.
   The bridge script stores initial inline values in `element.__glide_original_styles__` and applies new styles directly.
4. **Before / After Comparison**:
   Clicking the preview toggle sends `glide:clear-preview` to restore `__glide_original_styles__`, or re-sends staged styles to re-apply preview.
5. **Discard**:
   Clicking **Discard** sends `glide:clear-preview`, clears the in-memory map, and hides the staging bar. Source files remain untouched.
6. **Apply (Batch Commit)**:
   Clicking **Apply Changes** packages all staged entries into a single `batch-edit` WebSocket payload with a unique `batchSquashKey`.
   The server applies all mutations and creates a single squashed undo/redo entry in `HistoryStore`.
