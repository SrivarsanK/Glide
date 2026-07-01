---
phase: 07-layers-panel-and-reordering
plan: "03"
subsystem: AST
tags: [reorder, AST, JSX]
requires:
  - phase: 07-layers-panel-and-reordering
    plan: "02"
    provides: "getNestingPath breadcrumbs ancestor path resolver"
provides:
  - "reorderJSXElement AST mutation engine"
affects: []
tech-stack:
  added: []
  patterns:
    - "Babel AST child array splice mutations"
key-files:
  created:
    - "src/reorder.ts"
    - "src/reorder.test.ts"
  modified: []
key-decisions:
  - "Decoupled mutations by reordering the children arrays inside AST elements and only generating/replacing the string range of the root-most modified JSXElement, preserving the rest of the file layout formatting."
patterns-established:
  - "Non-destructive node reordering AST transformations."
requirements-completed:
  - LAYER-02
coverage:
  - id: D1
    description: "reorderJSXElement reordering siblings within parent"
    requirement: LAYER-02
    verification:
      - kind: unit
        ref: "src/reorder.test.ts#should reorder sibling elements within the same parent"
        status: pass
    human_judgment: false
  - id: D2
    description: "reorderJSXElement moving element to new parent container"
    requirement: LAYER-02
    verification:
      - kind: unit
        ref: "src/reorder.test.ts#should move element to a different parent container"
        status: pass
    human_judgment: false
duration: 20m
completed: 2026-07-01
status: complete
---

# Phase 7 Plan 3 Summary: AST Layer Reordering

**Implemented AST reordering mutator `reorderJSXElement` to relocate target elements within parent scopes or transfer nodes between containers.**
