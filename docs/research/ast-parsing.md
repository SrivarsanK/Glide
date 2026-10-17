# AST Parsing Research - Analysis

## Executive Summary

Modern web applications built with React, Vue, and Svelte present a unique challenge for visual editing tools. Developers expect source code to remain pristine, formatted according to their personal or organizational linting rules, and free from destructive structural side-effects. Traditional visual tools often rely on lossy code generation pipelines that re-serialize entire files, stripping developer comments, custom formatting, and non-standard syntax constructs. Solving this requires a deep architectural synthesis of Abstract Syntax Tree (AST) and Concrete Syntax Tree (CST) technologies.

The research reveals a fundamental separation of concerns required for visual source-code editing: fast incremental syntax tree tracking with error tolerance for interactive canvas selection (provided by Tree-sitter), zero-AST character-offset string mutation for high-frequency 60fps drag operations (provided by Magic-string), conservative format-preserving AST transformations for disk writes (provided by Recast and Babel), and structural tree diffing algorithms (such as GumTree) for calculating clean visual reordering edits.

For **Glide**, this analysis establishes a multi-tier hybrid architecture. Rather than relying on a single monolithic parser, Glide combines an in-memory incremental CST for real-time visual canvas tracking with a conservative AST mutation engine for non-destructive source writes. This architecture ensures strict adherence to Glide's primary design principle: *Source Code Integrity First*.

---

## Key Technical Findings

### Parser Comparison

Selecting the right parsing infrastructure requires evaluating performance, incremental parsing efficiency, error recovery capabilities, comment handling, and execution context (browser vs Node.js).

| Parser / Engine | Architecture / Language | Incremental Parsing | Error Recovery | Format / Comment Preservation | Primary Strengths & Trade-offs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tree-sitter** | C / Rust / Wasm (LR(1) / GLR) | **Yes** ($O(\log N)$ time) | **Built-in** (Yields `ERROR` / `MISSING` nodes) | Lossless CST (all tokens, comments, whitespace preserved) | **Best for visual canvas indexing.** Extremely fast incremental re-parsing on keystrokes. S-expression query engine. Requires Wasm build in browser. |
| **Recast / Babel** | JavaScript (ESTree-compatible AST) | No (Full re-parse required) | Moderate (`@babel/parser` fail-safe modes) | **Conservative printing** (preserves unmutated source code exact) | **Best for disk writeback.** Only re-prints mutated AST nodes. Re-uses original source formatting for untouched subtrees. |
| **SWC / Oxc** | Rust / Wasm / NAPI | No (Oxc has experimental incremental) | Partial (Fast error reporting) | AST comments array (Oxc features arena allocation) | **Highest raw parsing speed** (10x–40x faster than Babel). Ideal for fast scanning, but standard generators re-format printed code. |
| **TypeScript Compiler API** | TypeScript (Native AST) | Partial (Language Service incremental) | High (Tolerates ongoing syntax edits) | Preserves trivia (comments/spaces) via node ranges | **Standard for TypeScript/TSX.** Type-safe transformer factory API (`ts.factory`). Heavier bundle size for browser-only runtime. |
| **Magic-string** | JavaScript (String Slicing / VLQ Map) | N/A (Direct string offset edits) | N/A (Operates on text bounds) | **100% Preserved** (Zero AST re-serialization) | **Best for 60fps live drag.** Modifies string ranges via character offsets in memory without parsing overhead. |

### AST Manipulation Patterns

Safe AST transformation requires preserving lexical scopes, maintaining parent-child node pointers, and avoiding accidental syntax invalidation.

1. **Path-Based Traversal (`@babel/traverse`)**: Wrapping AST nodes in `NodePath` objects provides contextual inspection (`path.parent`, `path.scope`) and safe mutation methods (`path.replaceWith()`, `path.insertBefore()`, `path.remove()`).
2. **Immutable Transformer Factories (`TypeScript Compiler API`)**: Uses functional update functions (`ts.factory.updateJSXAttribute(...)`) rather than direct property mutation. This pattern prevents stale references and maintains structural integrity.
3. **Proxy-Based Node Binding (`Magicast`)**: Maps JS object getter/setters directly to underlying AST nodes, allowing intuitive syntax like `module.exports.theme.color = 'red'` while managing the underlying AST patch under the hood.
4. **ESQuery AST Selectors**: Enables CSS-style queries over ESTree nodes (e.g., `JSXElement[openingElement.name.name="Button"] > JSXAttribute[name.name="variant"]`), decoupling canvas selection logic from manual recursive tree walking.

### Code Generation from AST

Code generation in visual editors falls into two distinct categories:

- **Conservative Printing (Modifications)**: When mutating existing JSX elements or attributes, tools like **Recast** isolate modified nodes and re-print only those specific subtrees. Untouched subtrees are rendered verbatim from original source text, preserving custom line breaks, indentation, single/double quotes, and inline comments.
- **Algebraic Pretty Printing (New Synthesis)**: When generating new components from scratch, applying Wadler's **Doc Intermediate Representation** (used in Prettier) prevents outputting rigid string templates. By representing structural layout using `concat`, `group`, `indent`, and `line` combinators, the code generator dynamically adjusts line wraps and indentations according to the target project's formatting configuration.

### AST for Visual Editors

Visual editors for source code map to Martin Fowler's concept of **Projectional Editing**—editing an underlying model visually without textual parsing friction. In a developer-facing tool, a pure projectional model fails because developers require standard file system storage.

Glide resolves this via **Dual-Layer Synchronization**:
- **Live Drag Loop (Fluid Sizing / Color Picking)**: Operates at 60fps by updating CSS/inline style attributes using **Magic-string** range mutations. This bypasses AST re-parsing entirely during active mouse movements.
- **Drag Release (Commit)**: On mouse-up, the final delta is committed through the conservative AST printer (Recast), emitting a clean, minimal source patch.
- **Unified Component Resolution**: Custom components defined in local files are resolved within the parsed CST/AST, placing nested sub-components under their instantiation node rather than creating disconnected root nodes in the visual layers hierarchy.

### AST Diffing & Comparison

Line-based diffing tools (`git diff`) fail to capture semantic code operations. Structural AST diffing algorithms provide fine-grained edit scripts:

- **GumTree Algorithm (Falleri et al.)**: Uses a 4-phase matching pipeline:
  1. *Top-Down Phase*: Matches identical large subtrees using height and hash heuristics.
  2. *Bottom-Up Phase*: Matches parent containers if a threshold of their children match ($\text{Sim}(n_1, n_2) \ge \text{min\_height}$).
  3. *Refinement Phase*: Maps unmatched leaves using string similarity metrics.
  4. *Edit Script Generation*: Derives minimal atomic operations: $\text{Insert}(node, parent, pos)$, $\text{Delete}(node)$, $\text{Update}(node, value)$, and $\text{Move}(node, parent, pos)$.
- **ChangeDistilling (Fluri et al.)**: Combines tree structure comparison with string edit distances (Levenshtein / N-gram) on identifiers to classify refactorings into semantic categories (e.g., `COMPONENT_REORDER`, `PROP_MUTATION`).

---

## Most Relevant Papers & Sources

### 1. Falleri et al. (2014) — *Fine-grained and Accurate Source Code Differencing (GumTree)*
- **Core Contribution**: Established the state-of-the-art AST diffing algorithm that computes fine-grained edit scripts ($Insert$, $Delete$, $Update$, $Move$) by combining top-down isomorphic subtree matching with bottom-up container comparison.
- **Glide Application**: Formulates the foundation for layer rearrangement and re-parenting in the visual editor. Enables Glide to generate minimal git diffs when elements are dragged across containers.

### 2. Ben Newman (2014) — *Recast: Non-destructive JavaScript syntax tree transformer*
- **Core Contribution**: Introduced conservative printing for ASTs. By tracking original token bounds, Recast only re-prints mutated AST subtrees while reproducing unmutated nodes directly from original source text.
- **Glide Application**: Directly satisfies Glide Rule 1 (*Source Code Integrity First*), ensuring that editing a prop in the visual canvas never alters surrounding indentation, comments, or formatting in the user's codebase.

### 3. Tree-sitter Project (Brunsfeld et al., 2018) — *Incremental Parsing System*
- **Core Contribution**: Developed an LR(1)/GLR parser generator that builds complete Concrete Syntax Trees (CSTs) with $O(\log N)$ incremental re-parse speeds and robust error recovery on syntactically incomplete code.
- **Glide Application**: Serves as the primary canvas tracking parser, ensuring the visual canvas remains active and interactive even when source files contain syntax errors during typing.

### 4. Rich Harris (2015) — *Magic-string*
- **Core Contribution**: A lightweight string mutation library that applies slice replacements, insertions, and deletions via index offsets while generating high-precision Source Maps v3.
- **Glide Application**: Enables 60fps fluid visual resizing and live color picker dragging without invoking expensive AST parse-generate cycles on every animation frame.

### 5. Philip Wadler (2003) — *A Prettier Printer*
- **Core Contribution**: Defined an algebraic document combinator language (`Doc`) that decouples AST structural layout from line-wrapping layout solvers.
- **Glide Application**: Used when dropping new component library primitives onto the visual canvas to format newly synthesized code cleanly.

### 6. Beat Fluri et al. (2007) — *Change Distilling*
- **Core Contribution**: Extended tree diffing algorithms to extract semantic change classifications by evaluating both structural similarity and identifier edit distances.
- **Glide Application**: Provides the structural foundation for Glide's semantic visual undo/redo stack and change intent logging.

### 7. Martin Fowler & Markus Voelter (2008) — *Projectional Editing*
- **Core Contribution**: Articulated the mechanics of projectional visual interfaces operating over tree data models without intermediate text parsing steps.
- **Glide Application**: Validates Glide's dual-projection architecture: a Figma-like monochrome canvas frame projecting over underlying standard React/Vue/Svelte ASTs.

---

## Relevance to Glide

### Direct Applications

1. **Dual-Tier Parser Pipeline**: Tree-sitter CST for fast canvas node lookup and error-tolerant visual rendering; Recast + Babel for executing format-preserving disk writes.
2. **Fluid Drag Offsets**: Magic-string memory buffer for zero-overhead 60fps mouse drag operations (resizing handles, color sliders).
3. **Structural Layer Moves**: GumTree AST diffing for computing clean `Move` operations when users re-order nodes in the layers panel.
4. **Declarative Canvas Lookups**: ESQuery selector engine for finding target AST elements corresponding to DOM node selection events.

### Parser Recommendation

**Primary Recommendation: Hybrid Parser Architecture**

Glide should **not** rely on a single parser package. No single parser meets all requirements:
- Tree-sitter provides unmatched incremental speed ($O(\log N)$) and CST error tolerance, but cannot format-preserve direct AST mutations out of the box.
- Babel + Recast provides industry-standard JSX/TSX AST transformation and conservative printing, but lacks $O(\log N)$ incremental re-parsing.
- Magic-string provides zero-AST string index edits, but cannot perform structural transformations like component wrapping or re-parenting.

```
                  ┌─────────────────────────────────────────┐
                  │          Visual Canvas Event            │
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
  [Fluid Drag (60fps)]                                   [Discrete Commit / Edit]
            │                                                     │
            ▼                                                     ▼
┌─────────────────────────┐                             ┌───────────────────┐
│      Magic-string       │                             │ Recast + Babel /  │
│ (Index Range Overwrite) │                             │ TypeScript API    │
└───────────┬─────────────┘                             │ (AST Node Patch)  │
            │                                           └─────────┬─────────┘
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │  Source File Disk Write   │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │  Tree-sitter (CST Sync)   │
                         │ Incremental Canvas Update │
                         └───────────────────────────┘
```

### Future Considerations

- **Rust Wasm Acceleration**: As project sizes scale past 10,000 components, evaluating **Oxc** (Wasm build) for initial full-project background scanning will reduce cold-start index times.
- **Semantic Change Categorization**: Integrating ChangeDistilling taxonomy rules will allow Glide to present human-readable edit history (e.g., *"Reordered 3 items in Navbar"* instead of *"Updated App.tsx lines 42-88"*).

---

## Implementation Roadmap

1. **Phase 1: Dual-Parser Core Infrastructure**
   - Integrate Tree-sitter Wasm parser for JavaScript/JSX/TypeScript CST generation.
   - Set up Recast + Babel parser bridge for conservative format-preserving AST mutations.
   - Build unit test suite verifying that modifying a single JSX prop leaves comments, quotes, and indentation intact across untouched lines.

2. **Phase 2: High-Frequency Live Drag Buffer**
   - Implement `MagicString` buffer manager for instant mouse drag updates (width, height, inline style, color).
   - Hook mouse-down (capture initial range bounds), mouse-move (update `MagicString` buffer in memory), and mouse-up (commit patch to Recast AST).

3. **Phase 3: AST Diffing & Layer Rearrangement Engine**
   - Implement GumTree-inspired subtree matcher to generate $Insert$, $Delete$, $Move$ AST operations.
   - Wire layers panel drag-and-drop actions to structural AST `Move` edits.

4. **Phase 4: Component Library Synthesis**
   - Build Wadler / Prettier Doc IR formatter for synthesizing new visual component insertion templates.
   - Implement unified component resolution to map imported custom components into the canvas tree hierarchy.

---

## Code Patterns & Snippets

### 1. Tree-sitter Incremental Re-parse
```javascript
import Parser from 'web-tree-sitter';

await Parser.init();
const parser = new Parser();
const JavaScript = await Parser.Language.load('tree-sitter-javascript.wasm');
parser.setLanguage(JavaScript);

let tree = parser.parse('function App() { return <button>Click</button>; }');

// Apply keystroke/edit delta to CST
tree.edit({
  startIndex: 24,
  oldEndIndex: 30,
  newEndIndex: 27,
  startPosition: { row: 0, column: 24 },
  oldEndPosition: { row: 0, column: 30 },
  newEndPosition: { row: 0, column: 27 }
});

// Incremental re-parse in O(log N) time
const updatedTree = parser.parse('function App() { return <div>Click</div>; }', tree);
```

### 2. Recast Conservative AST Format Preservation
```javascript
import * as recast from 'recast';

const sourceCode = `
// Important developer comment
function Card() {
  return (
    <div className="card" color="#000000">
      <h1>Title</h1>
    </div>
  );
}
`;

const ast = recast.parse(sourceCode, {
  parser: require('recast/parsers/babel')
});

// Traverse and mutate single attribute
recast.visit(ast, {
  visitJSXAttribute(path) {
    if (path.node.name.name === 'color') {
      path.node.value = recast.types.builders.stringLiteral('#3b82f6');
    }
    this.traverse(path);
  }
});

// Conservative print preserves comments, quotes, and whitespace on untouched lines
const output = recast.print(ast).code;
```

### 3. Magic-string Live Drag Buffer (60fps Updates)
```javascript
import MagicString from 'magic-string';

const source = 'export const style = { width: 100, color: "#000000" };';
const s = new MagicString(source);

// Instant zero-AST range replacement during live mouse move
const startOffset = 42;
const endOffset = 49;
s.overwrite(startOffset, endOffset, '#3b82f6');

// Yields updated code and high-precision source map
const liveCode = s.toString();
const sourcemap = s.generateMap({ hires: true });
```

### 4. Babel Type-Safe JSX Mutation (`@babel/traverse` & `@babel/types`)
```javascript
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export function updatePropValue(ast, elementId, propName, newValue) {
  traverse(ast, {
    JSXElement(path) {
      const idAttr = path.node.openingElement.attributes.find(
        attr => t.isJSXAttribute(attr) && attr.name.name === 'data-glide-id'
      );
      
      if (idAttr && idAttr.value.value === elementId) {
        let propAttr = path.node.openingElement.attributes.find(
          attr => t.isJSXAttribute(attr) && attr.name.name === propName
        );

        if (propAttr) {
          propAttr.value = t.stringLiteral(newValue);
        } else {
          path.node.openingElement.attributes.push(
            t.jsxAttribute(t.jsxIdentifier(propName), t.stringLiteral(newValue))
          );
        }
      }
    }
  });
}
```

### 5. Wadler / Prettier Doc IR Combinator Pattern
```typescript
export type Doc =
  | { type: 'text'; text: string }
  | { type: 'concat'; docs: Doc[] }
  | { type: 'indent'; doc: Doc }
  | { type: 'group'; doc: Doc }
  | { type: 'line' };

export const docBuilders = {
  text: (text: string): Doc => ({ type: 'text', text }),
  concat: (docs: Doc[]): Doc => ({ type: 'concat', docs }),
  indent: (doc: Doc): Doc => ({ type: 'indent', doc }),
  group: (doc: Doc): Doc => ({ type: 'group', doc }),
  line: (): Doc => ({ type: 'line' })
};

// Generates nicely formatted JSX block dynamically
const newComponentDoc = docBuilders.group(
  docBuilders.concat([
    docBuilders.text('<Button'),
    docBuilders.indent(
      docBuilders.concat([
        docBuilders.line(),
        docBuilders.text('variant="primary"'),
        docBuilders.line(),
        docBuilders.text('onClick={handleClick}')
      ])
    ),
    docBuilders.line(),
    docBuilders.text('/>')
  ])
);
```
