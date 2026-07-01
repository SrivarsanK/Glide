# Phase 4 Research: Basic Overlay Canvas (React/Tailwind)

Research and architecture details for injecting a self-contained vanilla JS bridge (`overlay-bridge.js`) into the application iframe and rendering visual selection boundaries with resize handles.

## 1. Overlay-to-App Bridge Communication

Since the user's app runs in an iframe, the Glide overlay (parent) and the app (iframe) communicate via `postMessage`:
- **Injected Bridge (`overlay-bridge.js`)**:
  - Automatically injected into the page via the Vite plugin or client script.
  - Listens to mouse movements (hover) and click events on the live DOM.
  - When an element with a `data-cf-source` attribute is hovered or clicked, it reads the attribute value and calculates the element's bounding client rect:
    ```typescript
    const rect = element.getBoundingClientRect();
    ```
  - Sends coordinates and source information to the parent:
    ```typescript
    window.parent.postMessage({
      type: 'glide:element-selected',
      source: element.getAttribute('data-cf-source'),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    }, '*');
    ```

- **Canvas Overlay (Parent)**:
  - Listens to `message` events:
    ```typescript
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'glide:element-selected') {
        renderSelectionBox(event.data.rect, event.data.source);
      }
    });
    ```

## 2. Rendering the SVG Bounding Box and Resize Handles

The parent overlay renders an SVG layer on top of the iframe containing:
- **Selection Outline**: A blue border tracing the selected element.
- **Resize Handles**: 8-directional handle squares (Top-Left, Top-Center, Top-Right, Middle-Left, Middle-Right, Bottom-Left, Bottom-Center, Bottom-Right).
- **Drag Interaction**:
  - Clicking and dragging a handle sends resize/drag deltas back to the parent layout engine.
  - Delta updates are translated to styles (e.g. width/height, margin) and sent to the local Glide local server via WebSockets.

## 3. Mock DOM and Iframe Simulation for Testing

Since testing visual DOM overlays and iframes in Vitest can be challenging (Vitest runs in a Node environment by default), we can:
- Use Vitest with `jsdom` environment or mock the global `window`, `document`, and `postMessage` interfaces.
- Write tests that simulate events (hover, click, message transmission) and assert that the bridge sends the correct payloads and the overlay updates the selection state.
