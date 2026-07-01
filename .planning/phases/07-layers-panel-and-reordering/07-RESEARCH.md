# Phase 7 Research: Layers Panel & Reordering

Research and architecture details for generating the component tree hierarchy from the JSX/TSX AST and executing node reordering mutations.

## 1. Component Tree Data Structure

We need to traverse the AST of a file to extract the JSX hierarchy. Every JSX element has:
- A tag/component name (e.g., `div`, `button`, `span`, `Card`).
- A `data-cf-source` attribute value that serves as its unique ID (e.g. `src/App.tsx:10:5`).
- An array of child JSX elements.

We represent this with a node interface:
```typescript
export interface ComponentTreeNode {
  id: string; // The data-cf-source coordinate
  name: string; // Element tag name
  children: ComponentTreeNode[];
}
```

## 2. AST Traverser for Tree Generation

Using `@babel/parser` and `@babel/traverse`:
- Look for `JSXElement` nodes.
- Build a tree representation.
- Skip elements that do not have children JSX nodes (or leaf nodes containing only text can be represented, but for simplicity of visual layers, we focus on elements stamped with `data-cf-source`).

## 3. Node Reordering AST Mutation

To reorder layers or change nesting:
1. Locate the target JSX element to move (by matching `data-cf-source` values).
2. Locate its original parent element and remove the target node from its children list.
3. Locate the new parent element and insert the target node into its children list at the desired index.
4. Regenerate the affected JSX subtree using `@babel/generator` and replace the original file range of the parent node.
   - This approach ensures that only the parent node being modified is reprinted, leaving the rest of the file completely untouched (preserving format, indentation, and comments outside of the parent subtree).
