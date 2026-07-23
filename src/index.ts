export const VERSION = '0.1.0';

export { detectProjectMeta, generateVSCodeConfig } from '@srivarsank/core';
export { buildComponentTree, getNestingPath } from '@srivarsank/core';
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
} from '@srivarsank/ast-writer';
export { updateVueSFCClass, updateVueSFCStyle, updateVueSFCText } from '@srivarsank/adapter-vue';
export { updateSvelteClass, updateSvelteStyle, updateSvelteText } from '@srivarsank/adapter-svelte';
export { updateAstroClass, updateAstroStyle, updateAstroText } from '@srivarsank/adapter-astro';
export { updateHTMLClass, updateHTMLStyle, updateHTMLText, parseHTMLToReact, getElementClass } from '@srivarsank/adapter-html';
export { GlideServer, HistoryStore, saveUploadedAsset } from '@srivarsank/server';
export { getEditorHTML, GlideBridge, GlideOverlay, snapToGrid, measureTextLayout, resolveActiveBreakpoint } from '@srivarsank/overlay';
export { glideSourceStamping } from '@srivarsank/vite-plugin';


