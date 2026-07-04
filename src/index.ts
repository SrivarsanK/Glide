export const VERSION = '0.1.0';

export { detectProjectMeta, generateVSCodeConfig } from '@glide-dev/core';
export { buildComponentTree, getNestingPath } from '@glide-dev/core';
export { 
  updateClassName, 
  updateJSXText, 
  updateClassString, 
  updateJSXStyleProp, 
  computeNodeHash,
  reorderJSXElement,
  insertJSXElement,
  groupJSXElements,
  ungroupJSXElement,
  arrangeJSXElement,
  updateCSSModuleRule,
  parseTailwindClasses,
  updateTailwindClasses
} from '@glide-dev/ast-writer';
export { updateVueSFCClass } from '@glide-dev/adapter-vue';
export { updateSvelteClass } from '@glide-dev/adapter-svelte';
export { updateHTMLClass, updateHTMLText, parseHTMLToReact, getElementClass } from '@glide-dev/adapter-html';
export { GlideServer, HistoryManager, saveUploadedAsset } from '@glide-dev/server';
export { getEditorHTML, GlideBridge, GlideOverlay, snapToGrid, measureTextLayout, resolveActiveBreakpoint } from '@glide-dev/overlay';
export { default as glideSourceStampingPlugin } from '@glide-dev/babel-plugin';
export { glideSourceStamping } from './plugin.js'; // Keep existing plugin until fully migrated


