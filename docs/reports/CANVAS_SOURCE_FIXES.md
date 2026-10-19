# Canvas-to-source fixes

## October 19 live reproduction

The ignored `test-site` directory contains the application in the screenshots. Its `.panel-area` entrance animation was frozen at opacity 0 by design-mode animation pausing. Both preview bridges now disable CSS animations in design mode, exposing the normal underlying styles; Preview restores authored animations. Live DOM verification shows opacity 1 and animation-name none.

Ordinary canvas drags now change position without guessing a new JSX parent from DOM overlap. Explicit layer operations retain structural validation. Repeated templates keep the clicked DOM instance when resolving a source reference, and the properties panel identifies when edits affect multiple rendered instances. Layer highlighting scrolls only on a new selection, without smooth-scroll restarts.

The six test-site tabs share a single JSX template. Their existing 323px height is authored in that template; these fixes do not rewrite the user's existing dimensions. Independent instance styling and moving component roots/repeated expressions between parents remain unsupported. This is not complete Figma parity.

Final installed-package acceptance passed after rebuilding: entrance animation visibility, shared-template warning, retaining the second repeated instance on source reselection, source persistence, dragging/resizing, outside-frame workflows, idle reload stability, selection alignment, and production layout. The live test-site check confirmed panel visibility; repeated-template interaction was verified in the isolated browser fixture. The in-app browser logged stale-session handshake errors during server restart, so live write-back was not claimed from that browser session.

## Follow-up: detached selector, flashing, and structural target error

The October 18 screenshot follow-up exposed additional editor-shell bugs. Hover telemetry could switch the active source tree to a different component file while selection telemetry switched it back. Relative and canonical paths could also cause unnecessary tree requests. Hover no longer changes the active tree, and server-resolved file aliases are retained for comparisons.

Selection bounds were discarded while a position write was pending. If the bridge had already sent the final rectangle, it would not send that unchanged rectangle again, leaving an outline behind. Runtime bounds are now accepted during persistence; active drag/resize still owns its gesture preview. An iframe load clears invalid cached rectangles.

Canvas drag completion could implicitly reparent an element into another file and used the currently displayed file rather than the dragged element's source. Implicit reparenting now requires a mapped HTML container in the same source file and uses the dragged source's file. Crossing a component-file boundary during an ordinary drag retains the original parent and persists the position instead. Explicit unsupported cross-file structural operations remain protected by server validation.

Validation: package build, typecheck, bundled-artifact check, and full 416-test suite passed. The new regression file also passed with five checks after adding file-alias coverage. Installed-package browser acceptance passed, including outline-to-element alignment at 50% zoom during pending persistence and stable source-tree selection during repeated cross-file hover messages. These reproduce the identified mechanisms; the screenshot's original running application was not available in the repository.

Implemented and verified on October 18, 2026. Changes are in the local workspace; the distribution has been rebuilt. Restart a running Glide editor to load this build. From the website project's directory, the local CLI is `node C:/Users/Srivarsan/Desktop/Glide/dist/cli.js --no-skills`.

## What changed

- Drawing now writes the actual position and dimensions to authored JSX/TSX. Hit testing chooses mapped HTML containers and measures offsets against the containing block. It no longer clamps an outside-frame drawing into the website.
- New text, rectangles, ellipses, and frames can be created outside the page. These objects live in source as inactive JSX expressions, with workspace coordinates on the authored element. There is no separate JSON object store and no AI call in the editing path.
- **Move to canvas** removes a selected direct JSX child from the rendered page while retaining its source, event handlers, children, and lexical bindings. The **Outside frame** list supports text and dimension edits, deletion, and **Restore**. Dragging an outside object into a mapped container attaches it to the page. Dragging a page element out of the viewport also requests detachment.
- Source-backed objects survive editor reloads when their file's tree is loaded. Restore without a drag returns the object to its original parent and preserves its authored layout. A drag into the frame writes absolute placement.
- Newly created objects with literal inline styles can now be duplicated and moved. Same-scope moves preserve dynamic bindings. Windows structural references are compared using resolved filesystem paths.
- Explicit viewport dimensions stay fixed through document updates. Zoom stays anchored under the pointer, and ruler/guide coordinates use actual frame bounds. The canvas no longer animates every zoom/pan transform.
- Bridge observers ignore editor highlight attributes and coalesce relevant DOM updates. HMR handlers dispose their listeners. Selecting or dragging no longer destroys existing transforms, transitions, stacking, typography, or gradient styling.
- **Preview** enables page interactions and CSS animations; **Back to design** resumes editing. Design mode disables CSS animations and transitions without rewriting the source.

## Verification

- `npm run build` — passed, including package-level compilation and generated declarations.
- `npm run typecheck` — passed.
- `npm test -- --silent --reporter=dot` — 47 files, 417 tests passed.
- `npm run test:artifact` — passed for the bundled editor and queued mutation transport.
- `npm run test:consumer` — passed against an isolated installed package and a real browser. Covers source persistence, pointer drag/resize, drawing coordinates, detach/reload/restore, outside text creation/edit, drag into frame, source deletion, preview switching, fixed viewport, idle reload stability, and production layout without Glide.
- `git diff --check` — passed.

## Current boundaries

This is not complete Figma parity. The verified transactional structural workflow is JSX/TSX; equivalent off-frame authoring for Vue, Svelte, Astro, and HTML is not implemented here. Unmapped runtime elements remain non-editable rather than guessing a source target.

Off-frame previews show static text, inline styles, and static children derived from source. They do not execute expressions or imported components, and do not reproduce every stylesheet-driven layout. Workspace objects are loaded per source file as its tree is requested, rather than through a project-wide pasteboard index.

Detachment requires a direct authored JSX child. Component roots and repeated expression instances need additional boundary handling. Cross-file attachment and moves across unsafe lexical scopes remain blocked. CSS animation pause does not freeze arbitrary JavaScript timers or application state.

The original screenshot application is now running locally at http://127.0.0.1:7777 with its Vite preview on port 5174. The live animation check complements isolated installed-package browser acceptance; neither establishes universal compatibility with every application.
