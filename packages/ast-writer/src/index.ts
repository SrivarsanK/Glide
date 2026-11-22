/**
 * @srivarsank/ast-writer — AST-based source file manipulation.
 */

export { findJSXElementAt, updateClassName, updateJSXText, updateClassString, updateJSXStyleProp, computeNodeHash } from './writer.js';
export { transformJSXBatch } from './writer.js';
export { listWorkspaceObjects } from './workspace.js';
export { layoutStyles } from './layout.js';
export type { WorkspaceObject, WorkspacePreview } from './workspace.js';
export { inspectJSXProps, checkAttributeValue, templateAttributeName } from './props.js';
export { forwardsClassName, activeVariants } from './edit-scope.js';
export type { ActiveVariant } from './edit-scope.js';
export type { JSXMutation } from './writer.js';
export type { StructuralChange, RetagSurroundings } from './structure.js';
export { checkRetag, RETAG_TARGETS } from './structure.js';
export type { VariantOption } from './class-expression.js';
export { parseJSXElements } from './reorder.js';
export type { JSXElementRecord } from './reorder.js';

