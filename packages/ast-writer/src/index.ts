/**
 * @srivarsank/ast-writer — AST-based source file manipulation.
 */

export { findJSXElementAt, updateClassName, updateJSXText, updateClassString, updateJSXStyleProp, computeNodeHash } from './writer.js';
export { transformJSXBatch } from './writer.js';
export { listWorkspaceObjects } from './workspace.js';
export type { WorkspaceObject, WorkspacePreview } from './workspace.js';
export { inspectJSXProps } from './props.js';
export { forwardsClassName, activeVariants } from './edit-scope.js';
export type { ActiveVariant } from './edit-scope.js';
export type { JSXMutation } from './writer.js';
export { reorderJSXElement, insertJSXElement, groupJSXElements, ungroupJSXElement, arrangeJSXElement, parseJSXElements } from './reorder.js';
export type { JSXElementRecord } from './reorder.js';
export { updateCSSModuleRule, rewriteTailwindToken, rewriteClassNameToken } from './css.js';
export { parseTailwindClasses, updateTailwindClasses } from './properties.js';

