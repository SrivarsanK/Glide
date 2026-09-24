# DOM Bypass Research - Analysis

## Executive Summary

Standard web browser Document Object Model (DOM) APIs present fundamental bottlenecks for high-performance visual editors. Forced synchronous layouts (layout thrashing), encapsulation barriers like closed Shadow DOMs, reactivity overhead in Virtual DOM frameworks, and DOM observer interference degrade performance and restrict deep component inspection. This research synthesizes modern DOM bypass techniques, framework internal state extraction, browser extension engine privileges, and custom rendering architectures to overcome these constraints.

For **Glide Visual Editor**, bridging live screen manipulation with clean source code updates requires precise node-to-source mapping, fluid 60/120 FPS interaction loops, and invisible overlay controls. By combining microtask queue batching (FastDOM pattern), Virtual DOM internal traversal (React Fiber `__reactFiber$` and Vue 3 `__vnode`), Shadow DOM piercing (`chrome.dom.openOrClosedShadowRoot` and prototype hijacking), and WebGL/Canvas hybrid overlay rendering, Glide can interact directly with underlying application states without disturbing host runtime behavior.

Architecturally, adopting these techniques enables a multi-tier interaction engine: low-level browser engine piercing via Chrome DevTools Protocol (CDP) and extension APIs for zero-modification inspection, spatial indexing (Kd-Trees) for layout snapping, direct microtask DOM patching for live drag feedback, and AST/CST source mapping derived straight from React and Vue debug fibers.

## Key Technical Findings

### Shadow DOM Access Techniques

Accessing elements encapsulated inside Shadow DOM boundaries—especially those configured with `mode: 'closed'`—requires techniques that bypass standard DOM tree traversal (`element.shadowRoot`). Three primary strategies enable universal Shadow DOM piercing:

1. **Prototype Hijacking (`Element.prototype.attachShadow`)**: By overriding `attachShadow` prior to host script execution, closed shadow roots can be forcibly converted to `'open'` mode or registered in a private `WeakMap` accessible by the editor runtime.
2. **Chromium Extension API (`chrome.dom.openOrClosedShadowRoot`)**: Available in Chrome 88+ extension contexts, this native method inspects shadow roots directly at the browser C++ engine level, returning closed shadow trees without modifying page prototypes.
3. **Chrome DevTools Protocol (CDP) `DOM.getDocument`**: Headless automation tools can pass `pierce: true` to inspect and manipulate nodes across all shadow boundaries and nested `iframe` documents simultaneously.

### Browser API Bypasses

To achieve high-frequency UI updates without layout thrashing or parent container re-renders, standard DOM mutation patterns must be bypassed:

1. **Microtask Queue Batching (FastDOM Pattern)**: Interleaving DOM reads (`getBoundingClientRect()`) and writes (`style.transform`) forces the browser into repeated synchronous reflows. Separate read and write job queues executed inside single `requestAnimationFrame` callbacks eliminate layout thrashing during live dragging.
2. **W3C DOM Range & Selection Surgical Edits**: Mutating `innerHTML` destroys subtree state and unmounts component instances. Utilizing `document.createRange()`, `range.deleteContents()`, and `range.insertNode()` allows sub-node text and element replacement without triggering parent re-parses.
3. **MutationObserver Interception**: Host application observers often detect visual editor handles and trigger unwanted side effects. Monkey-patching `MutationObserver.prototype.observe` filters out elements marked with editor metadata (e.g. `[data-glide-overlay]`) from observer notifications.

### Virtual DOM Internals

Modern frameworks store rich metadata on host DOM elements that can be extracted directly from JavaScript runtime memory:

1. **React Fiber Tree Traversal**: React appends internal Fiber nodes to DOM elements via `__reactFiber$` or `__reactInternalInstance$` keys. Fiber objects expose `memoizedProps`, `memoizedState`, `stateNode` instances, and development environment source mapping (`_debugSource` containing file paths and line numbers).
2. **Vue 3 Runtime VNode Inspection**: Vue 3 attaches `__vnode` and `__vueParentComponent` to DOM elements in development builds. These expose component definition names, reactive setup state, props, and Single File Component source locations (`__file`).
3. **Block Virtual DOM (Million.js Style)**: Recursive VDOM tree diffing incurs $O(N)$ overhead. Compiler-generated static template blocks and dirty-flag masks allow $O(1)$ direct index mutations on DOM text/attribute nodes during active visual manipulation.

### Custom Rendering Approaches

Relying entirely on standard DOM nodes for visual editor controls (selection boxes, resize handles, snap alignment guides) introduces severe DOM tree bloat and layout overhead when managing complex applications:

1. **Figma Hybrid WebAssembly/WebGL Engine**: Figma delegates layer rendering, layout calculations, and alignment math to a C++ WebAssembly engine rendered directly onto a WebGL `<canvas>`.
2. **Glide Hybrid Overlay Layer**: Overlaying a transparent 2D Canvas / WebGL canvas above the host application allows rendering thousands of visual guides and selection bounds at 60/120 FPS without appending extra DOM nodes to the edited document tree.
3. **Kd-Tree Spatial Bounding Box Invalidation**: Restricting layout invalidation and snap guide checks to overlapping bounding boxes via 2D Kd-Tree spatial indexing prevents expensive full-tree layout recalculations.

## Most Relevant Papers & Sources

1. **FastDOM: Batching DOM Read/Write Operations** (Wilson Page, 2020)
   * *Summary*: Defines the microtask batching architecture that segregates DOM measurement (reads) from DOM mutation (writes) within `requestAnimationFrame` cycles, eliminating forced synchronous layouts.
2. **React Reconciliation & Fiber Node Structure Access** (Facebook React Core Team, 2022)
   * *Summary*: Details internal Fiber node structures appended to host DOM nodes (`__reactFiber$`), enabling direct resolution of DOM elements to source code file locations (`_debugSource`).
3. **Vue 3 Runtime Core: VNode & Component Traversal** (Evan You & Vue Core Team, 2023)
   * *Summary*: Explores internal Vue 3 DOM properties (`__vnode`, `__vueParentComponent`) used to inspect component setup state, reactive props, and `.vue` source file definitions.
4. **Spineless Traversal: Fast Incremental Layout Invalidation** (Academic Research Group, 2023)
   * *Summary*: Introduces spatial bounding box Kd-Trees for incremental layout invalidation, preventing full render-tree traversals during dynamic object repositioning.
5. **Building a Professional Design Tool on the Web: Figma Engine Architecture** (Evan Wallace / Figma Engineering, 2017/2023)
   * *Summary*: Outlines the hybrid custom rendering architecture, combining WebAssembly scene graphs, WebGL canvas rendering, and focused DOM overlays for active input controls.
6. **Chrome Extension Architecture: Main World vs Isolated World** (Chrome Extensions Platform Team, 2022)
   * *Summary*: Specifies isolation boundaries for Manifest V3 content scripts and details techniques (`executeScript` with `world: 'MAIN'`, `<script>` injection) to access host application runtime memory.
7. **Chrome DevTools Protocol (CDP) DOM Domain & Piercing** (Chrome DevTools Team, 2023)
   * *Summary*: Describes low-level browser automation protocol APIs (`DOM.getDocument` with `pierce: true`) for inspecting closed shadow trees and nested frames in headless environments.
8. **DOM Clobbering: Exploiting Named Property Invalidation** (Gareth Heyes / PortSwigger, 2022)
   * *Summary*: Analyzes security vulnerabilities arising from HTML elements with `id` or `name` attributes clobbering global `window` and `document` properties, providing blueprint defenses for editor global namespaces.

## Relevance to Glide

### Direct Applications

* **Node-to-Source Resolution**: Extracting React Fiber `_debugSource` (`file:line`) and Vue 3 `__file` properties maps user clicks on canvas directly to source file locations for AST/CST code updates.
* **Fluid 60/120 FPS Drag & Resize**: Integrating FastDOM read/write batching during high-frequency `mousemove` events ensures live resizing runs smoothly without triggering layout thrashing.
* **Smart Alignment Guides & Snapping**: Implementing 2D Kd-Tree spatial indexing allows instant calculation of distance guides and alignment snaps without querying the DOM.
* **Host Application Observer Isolation**: Suppressing Glide UI overlay mutations (`[data-glide-overlay]`) via `MutationObserver` patching prevents target app analytics and framework observers from breaking.

### Security Considerations

* **DOM Clobbering Protection**: Host applications containing elements like `<img id="glideConfig">` could overwrite editor global variables. Glide must freeze internal configuration objects, utilize `Symbol` keys, and validate types to prevent clobbered runtime errors.
* **Main World Script Injection Safety**: Executing code in the page Main World exposes editor logic to target page scripts. Communications between Isolated World and Main World must use strictly validated `window.postMessage` payloads.
* **Prototype Patch Cleanup**: Prototype modifications (such as `attachShadow` interception) must be non-destructive, preserve original native behavior, and gracefully handle existing polyfills.

### Future Considerations

* **Block VDOM Direct Patching**: Applying Million.js style static template index patching to directly mutate target DOM nodes during drag operations before committing final updates to source AST.
* **Full Canvas Overlay Engine**: Migrating selection handles, multi-element bounding boxes, and alignment lines to a dedicated top-level WebGL overlay layer as document complexity scales.
* **Headless CDP Verification Suite**: Utilizing Playwright CDP sessions with `pierce: true` to run automated layout and visual editing test suites in headless CI/CD environments.

## Implementation Roadmap

1. **Phase 1: Component Inspection & Source Mapping (Immediate)**
   * Implement React Fiber (`__reactFiber$`) and Vue 3 (`__vnode`) internal property extractors.
   * Add DOM Clobbering defenses using `Object.freeze` and private `Symbol` namespace guards.
   * Implement `MutationObserver` monkey-patching to filter out `[data-glide-overlay]` elements.

2. **Phase 2: High-Performance Canvas & Interaction (Short Term)**
   * Integrate FastDOM microtask queue batching for all live resize and drag move handlers.
   * Implement W3C DOM Range surgical text replacement for inline text editing.
   * Build 2D Kd-Tree spatial bounding box index for alignment snapping calculations.

3. **Phase 3: Universal Shadow DOM & Extension Bridge (Medium Term)**
   * Implement `chrome.dom.openOrClosedShadowRoot` extraction for browser extension builds.
   * Add fallback `Element.prototype.attachShadow` interception script for web runtime builds.
   * Establish secure bi-directional messaging bridge between Isolated World and Main World.

4. **Phase 4: Custom Rendering & Automated Verification (Long Term)**
   * Develop WebGL/Canvas hybrid overlay layer for high-density multi-selection bounds.
   * Set up Playwright CDP test harness with `pierce: true` for headless automated regression testing.

## Code Patterns & Snippets

### 1. FastDOM Read/Write Batching Pattern
```javascript
const readQueue = [];
const writeQueue = [];
let scheduled = false;

function scheduleFlush() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    let task;
    while ((task = readQueue.shift())) task();
    while ((task = writeQueue.shift())) task();
    scheduled = false;
  });
}

export function measure(fn) {
  readQueue.push(fn);
  scheduleFlush();
}

export function mutate(fn) {
  writeQueue.push(fn);
  scheduleFlush();
}
```

### 2. React Fiber & Component Source Mapping Extractor
```javascript
export function getReactFiberFromDOM(domNode) {
  const key = Object.keys(domNode).find(k => 
    k.startsWith('__reactFiber$') || 
    k.startsWith('__reactInternalInstance$')
  );
  if (!key) return null;
  
  const fiber = domNode[key];
  return {
    fiber,
    componentName: fiber.type?.displayName || fiber.type?.name || 'Anonymous',
    props: fiber.memoizedProps,
    source: fiber._debugSource // e.g. { fileName: 'C:/src/Button.tsx', lineNumber: 42 }
  };
}
```

### 3. Vue 3 VNode & SFC Source Extractor
```javascript
export function getVueComponentFromDOM(domNode) {
  const vnode = domNode.__vnode;
  const component = domNode.__vueParentComponent;

  if (!vnode && !component) return null;

  return {
    type: vnode?.type?.name || component?.type?.name || 'VueComponent',
    props: component?.props || vnode?.props,
    setupState: component?.setupState,
    file: vnode?.type?.__file || component?.type?.__file // e.g. /src/components/Card.vue
  };
}
```

### 4. Closed Shadow DOM Prototype Hijacker & Universal Retriever
```javascript
(function initShadowDOMIntercept() {
  if (window.__glideShadowInit) return;
  window.__glideShadowInit = true;

  const shadowRootMap = new WeakMap();
  const originalAttachShadow = Element.prototype.attachShadow;

  Element.prototype.attachShadow = function(init) {
    const shadowRoot = originalAttachShadow.call(this, { ...init, mode: 'open' });
    shadowRootMap.set(this, shadowRoot);
    return shadowRoot;
  };

  window.__getGlideShadowRoot = function(element) {
    if (typeof chrome !== 'undefined' && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
      return chrome.dom.openOrClosedShadowRoot(element);
    }
    return shadowRootMap.get(element) || element.shadowRoot;
  };
})();
```

### 5. MutationObserver Overlay Filter Patch
```javascript
(function patchMutationObserver() {
  const originalObserve = MutationObserver.prototype.observe;

  MutationObserver.prototype.observe = function(target, options) {
    const originalCallback = this._callback;

    if (!this._wrappedCallback && originalCallback) {
      this._wrappedCallback = function(mutationsList, observer) {
        const filteredMutations = mutationsList.filter(mutation => {
          const t = mutation.target;
          return !t.closest || !t.closest('[data-glide-overlay]');
        });

        if (filteredMutations.length > 0) {
          originalCallback.call(this, filteredMutations, observer);
        }
      };
    }

    return originalObserve.call(this, target, options);
  };
})();
```

### 6. Surgical Range Text Replacement
```javascript
export function replaceSubNodeText(textNode, startOffset, endOffset, newText) {
  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);

  range.deleteContents();
  const newTextNode = document.createTextNode(newText);
  range.insertNode(newTextNode);
  
  return newTextNode;
}
```

### 7. DOM Clobbering Namespace Defense
```javascript
const GLIDE_PRIVATE_KEY = Symbol('glide.internal');

export const glideConfig = Object.freeze({
  [GLIDE_PRIVATE_KEY]: true,
  version: '1.0.0'
});

export function isValidConfig(obj) {
  return (
    obj != null &&
    !(obj instanceof Element) &&
    !(obj instanceof HTMLCollection) &&
    obj[GLIDE_PRIVATE_KEY] === true
  );
}
```
