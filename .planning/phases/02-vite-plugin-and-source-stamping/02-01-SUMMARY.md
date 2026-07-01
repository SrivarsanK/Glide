---
phase: 02-vite-plugin-and-source-stamping
plan: "01"
subsystem: build
tags: [vite, babel, ast]
requires:
  - phase: 01-environment-and-tooling-setup
    provides: "Configured package.json and tsconfig.json"
provides:
  - "Vite plugin for development source-stamping"
affects: []
tech-stack:
  added:
    - "@babel/core"
    - "@types/babel__core"
  patterns:
    - "Vite plugin AST transform during dev serve"
key-files:
  created:
    - "src/plugin.ts"
    - "src/plugin.test.ts"
  modified:
    - "package.json"
key-decisions:
  - "Configured @babel/core parserOpts.plugins with ['jsx', 'typescript'] to parse TSX files natively without needing extra Babel preset packages."
patterns-established:
  - "Vite transform-based source coordinates injection active only during dev mode (command === 'serve')."
requirements-completed:
  - TRANS-01
  - TRANS-02
coverage:
  - id: D1
    description: "Vite plugin data-cf-source attribute injection in development"
    requirement: TRANS-01
    verification:
      - kind: unit
        ref: "src/plugin.test.ts#injects data-cf-source attributes in dev mode"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vite plugin production transform bypass"
    requirement: TRANS-02
    verification:
      - kind: unit
        ref: "src/plugin.test.ts#does not inject data-cf-source in production build mode"
        status: pass
    human_judgment: false
duration: 15m
completed: 2026-07-01
status: complete
---

# Phase 2 Plan 1 Summary: Vite Plugin & Source-Stamping

**Implemented a development-only Vite transformation plugin that stamps JSX opening elements with project-relative source code coordinates.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-27T22:31:00Z
- **Completed:** 2026-07-01T09:09:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created the `glideSourceStamping` Vite plugin in [src/plugin.ts](file:///c:/Users/Srivarsan/Desktop/Glide/src/plugin.ts) which targets JSX/TSX elements and appends the `data-cf-source` attribute.
- Configured the plugin to skip transformation when building for production (verifying that `command !== 'serve'`).
- Created and successfully executed unit tests in [src/plugin.test.ts](file:///c:/Users/Srivarsan/Desktop/Glide/src/plugin.test.ts) covering development injection, production bypass, and file filtering.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Babel core dependencies** - `chore(build): add Babel core dependencies`
2. **Task 2: Implement Vite source stamping plugin** - `feat(core): implement glideSourceStamping Vite plugin`
3. **Task 3: Add unit tests for the Vite plugin** - `test(core): add unit tests for Vite plugin`

## Files Created/Modified

- [package.json](file:///c:/Users/Srivarsan/Desktop/Glide/package.json) - Added `@babel/core` and `@types/babel__core`.
- [src/plugin.ts](file:///c:/Users/Srivarsan/Desktop/Glide/src/plugin.ts) - Source position stamping Vite plugin.
- [src/plugin.test.ts](file:///c:/Users/Srivarsan/Desktop/Glide/src/plugin.test.ts) - Tests for plugin transformation behaviors.

## Decisions Made

- Standardized on 1-indexed coordinates for both lines and columns within `data-cf-source="path:line:col"` to conform to standard editor and source link conventions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Source position stamping is operational and verified via tests.
- Ready to move to Phase 3: WebSocket Server & AST Write-Back to establish live communication and mutate source files.
