export { VERSION } from './version.js';

export { detectProjectMeta, buildComponentTree, getNestingPath } from '@srivarsank/core';
export { transformJSXBatch, updateClassName, updateJSXText, updateClassString, updateJSXStyleProp, computeNodeHash } from '@srivarsank/ast-writer';
export type { JSXMutation } from '@srivarsank/ast-writer';
export { updateVueSFCClass, updateVueSFCStyle, updateVueSFCText } from '@srivarsank/adapter-vue';
export { setSvelteClassAt, setSvelteStyleAt, setSvelteTextAt } from '@srivarsank/adapter-svelte';
export { setAstroClassAt, setAstroStyleAt, setAstroTextAt } from '@srivarsank/adapter-astro';
export { GlideServer, HistoryStore, saveUploadedAsset } from '@srivarsank/server';
export { getEditorHTML } from '@srivarsank/overlay';
export { glideSourceStamping } from '@srivarsank/vite-plugin';
