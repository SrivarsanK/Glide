export const VERSION = '0.1.0';

export { glideSourceStamping } from './plugin.js';
export { GlideServer } from './server.js';
export { detectProjectMeta, generateVSCodeConfig } from './meta.js';
export { HistoryManager } from './history.js';
export { updateVueSFCClass } from './vue.js';
export { updateSvelteClass } from './svelte.js';
export { updateCSSModuleRule } from './css.js';
export { updateClassString, updateClassName, updateJSXText } from './writer.js';
export { GlideBridge } from './bridge.js';
export { GlideOverlay } from './overlay.js';
export { snapToGrid } from './snap.js';
export { saveUploadedAsset } from './assets.js';
export { reorderJSXElement, insertJSXElement } from './reorder.js';
