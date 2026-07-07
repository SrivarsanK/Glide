/**
 * @srivarsank/core — Shared types, utilities, and framework detection.
 */

export * from './types.js';
export { computeNodeHash } from './utils.js';
export { detectProjectMeta, detectStyling, generateVSCodeConfig } from './detect.js';
export { buildComponentTree, getNestingPath } from './tree.js';
export type { FrameworkAdapter, AdapterAST, AdapterNode } from './adapter.js';
export { scanProject, scanFile } from './scanner.js';
export type { ScanResult, ScannedElement, ResolvedValue, StateStyles, ScanOptions } from './scanner.js';
