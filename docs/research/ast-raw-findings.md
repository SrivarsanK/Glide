# Abstract Syntax Tree (AST) Research & Raw Findings

## Executive Summary
This document captures research on Abstract Syntax Tree (AST) and Concrete Syntax Tree (CST) parsing, manipulation, code generation, structural diffing, academic research, and practical visual editor architecture. It directly informs the design of **Glide**—a visual editor for React/Vue/Svelte apps that performs non-destructive, format-preserving AST/CST transformations directly on user source code.

---

## 1. Primary Sources & Literature Findings

### Source 1: Tree-sitter — High-Performance Incremental Concrete Syntax Tree Parser
- **Title**: Tree-sitter: An Incremental Parsing System for Programming Tools
- **URL**: https://tree-sitter.github.io/tree-sitter/
- **Authors**: Max Brunsfeld et al. (GitHub)
- **Year**: 2018–present
- **Key Findings & Contributions**:
  - Tree-sitter builds a complete **Concrete Syntax Tree (CST)** retaining all source tokens, whitespace, comments, and punctuation.
  - Features **LR(1) / GLR incremental parsing**: when source text changes (e.g. keypresses in an editor), Tree-sitter updates the syntax tree in $O(\log N)$ time by re-parsing only edited regions and reusing unaffected subtrees.
  - Provides **error recovery**: even with invalid/incomplete syntax during live editing, Tree-sitter yields a robust partial CST with `ERROR` or `MISSING` nodes.
  - Distinguishes **named nodes** (semantic items like `function_declaration`, `jsx_element`) from **anonymous nodes** (delimiters like `{`, `,`, `<`).
  - Includes a S-expression query language (CSS-like) with pattern matching and node capture capabilities.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  const Parser = require('tree-sitter');
  const JavaScript = require('tree-sitter-javascript');
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  const tree = parser.parse('function App() { return <div>Hello</div>; }');
  // Incremental edit update
  tree.edit({
    startIndex: 13, oldEndIndex: 13, newEndIndex: 18,
    startPosition: {row: 0, column: 13}, oldEndPosition: {row: 0, column: 13}, newEndPosition: {row: 0, column: 18}
  });
  const updatedTree = parser.parse('function AppWorld() { return <div>Hello</div>; }', tree);
  ```
- **Benefit for Glide Visual Editor**:
  - Essential for real-time visual canvas synchronization during active typing or fluid dragging.
  - Error-tolerant CST allows Glide canvas to remain stable even when user source code has temporary syntax errors.
  - Retains exact byte offsets and tokens needed for lossless visual edit writes back to disk.

---

### Source 2: Falleri et al. (2014) — GumTree AST Differencing Algorithm
- **Title**: Fine-grained and Accurate Source Code Differencing
- **URL**: https://dl.acm.org/doi/10.1145/2642937.2642982
- **Authors**: Jean-Rémy Falleri, Floréal Morandat, Xavier Blanc, Matias Martinez, Martin Monperrus
- **Year**: 2014 (Published in Proc. ASE '14)
- **Key Findings & Contributions**:
  - Introduces **GumTree**, a state-of-the-art AST diffing algorithm that computes fine-grained, minimal edit scripts ($Insert, Delete, Update, Move$).
  - Addresses limitations of line-based diff (`git diff`) by comparing structural nodes instead of raw text lines.
  - Operates in multi-phase matching:
    1. **Top-Down Phase (Greedy Subtree Matching)**: Matches isomorphic subtrees based on hash/height heuristics to quickly isolate unchanged code blocks.
    2. **Bottom-Up Phase (Container Matching)**: Matches parent nodes if a threshold fraction of their children/descendants were matched in phase 1.
    3. **Recovery & Refinement Phase**: Maps remaining unmatched leaf nodes using similarity metrics.
    4. **Edit Script Generation**: Derives minimal tree edit sequence ($Insert, Delete, Update, Move$) using Chawathe's algorithm.
- **Relevant Code Patterns & Algorithms**:
  $$\text{Sim}(n_1, n_2) = \frac{|\text{matched\_children}(n_1, n_2)|}{\max(|children(n_1)|, |children(n_2)|)}$$
  - Generates structural operations:
    - `Move(node, target_parent, position)`
    - `Update(node, new_value)`
    - `Insert(node, parent, position)`
    - `Delete(node)`
- **Benefit for Glide Visual Editor**:
  - Enables precise visual diffing when dragging visual components (layer rearrangement, parent-child re-parenting).
  - Helps Glide calculate minimal source patch edits when users reorder JSX children or change props, guaranteeing minimal git noise.

---

### Source 3: Fluri et al. (2007) — ChangeDistilling AST Differencing
- **Title**: Change Distilling: Tree Differencing for Fine-Grained Source Code Change Extraction
- **URL**: https://doi.org/10.1109/TSE.2007.70731
- **Authors**: Beat Fluri, Michael Würsch, Martin Pinzger, Harald C. Gall
- **Year**: 2007 (IEEE Transactions on Software Engineering)
- **Key Findings & Contributions**:
  - Extends Chawathe's tree diffing algorithm specifically for source code evolution and AST change classification.
  - Achieved a reduction in edit script error from 79% down to 34% by combining string similarity (n-grams, Levenshtein) on node labels with structural subtree similarity.
  - Established a taxonomy of 47 fine-grained source code changes (e.g., `STATEMENT_INSERT`, `PARENT_CLASS_CHANGE`, `ATTRIBUTE_RENAMING`).
- **Relevant Code Patterns & Algorithms**:
  - Node similarity evaluation incorporating both subtree structure and string edit distance of identifier names.
  - Classification pipeline converting low-level tree edits into semantic refactoring intent.
- **Benefit for Glide Visual Editor**:
  - Classifies user visual drag/drop edits into semantic actions (e.g., "Style Prop Mutation", "Component Reorder", "Wrapper Element Insertion").
  - Provides semantic undo/redo history in the visual editor canvas.

---

### Source 4: Wadler (2003) — "A Prettier Printer" Architectural Foundations
- **Title**: A Prettier Printer
- **URL**: https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf
- **Authors**: Philip Wadler
- **Year**: 2003 (Journal of Functional Programming)
- **Key Findings & Contributions**:
  - Introduces an elegant algebraic framework for AST-to-text code generation via Document Intermediate Representation (`Doc`).
  - Separates AST-to-Doc conversion from Doc-to-String rendering (layout solving).
  - Primitives include: `text("s")`, `concat(d1, d2)`, `nest(indent, d)`, `group(d)`, `line`.
  - The `group` combinator allows the layout solver to attempt printing a subtree on a single line; if it exceeds line length, it automatically breaks across multiple lines.
  - Forms the theoretical foundation of modern formatters like **Prettier**, **Black**, and **rustfmt**.
- **Relevant Code Patterns & Algorithms**:
  ```typescript
  type Doc = 
    | { type: 'text', text: string }
    | { type: 'concat', docs: Doc[] }
    | { type: 'nest', indent: number, doc: Doc }
    | { type: 'group', doc: Doc }
    | { type: 'line' };
  ```
- **Benefit for Glide Visual Editor**:
  - Used when visual editor creates brand-new component JSX elements from scratch (e.g., dropping a new `<Button />` into canvas).
  - Guarantees newly synthesized AST subtrees are automatically formatted according to the project's print width and indentation rules without breaking developer style.

---

### Source 5: Wagner & Graham (1998) — Incremental Parsing for Interactive Environments
- **Title**: Efficient and Flexible Incremental Parsing
- **URL**: https://doi.org/10.1145/293677.293678
- **Authors**: Tim A. Wagner, Susan L. Graham
- **Year**: 1998 (ACM TOPLAS)
- **Key Findings & Contributions**:
  - Seminal work on incremental parsing algorithms for interactive language-sensitive software development environments (SDEs).
  - Demonstrates how to maintain a valid syntax tree across user keystrokes with minimal recomputation.
  - Solved incremental parsing for full LR(1) grammars using parse stack state saving and subtree reuse heuristics.
- **Relevant Code Patterns & Algorithms**:
  - Structural comparison of parse stacks and token streams to detect maximum non-affected subtree bounds.
- **Benefit for Glide Visual Editor**:
  - Direct predecessor to modern tree-sitter algorithms; highlights why visual editors must maintain incremental CST state during dual-mode editing (code view + visual canvas).

---

### Source 6: Recast — Nondestructive AST Transformation & Conservative Printing
- **Title**: Recast: Non-destructive JavaScript syntax tree transformer
- **URL**: https://github.com/benjamn/recast
- **Authors**: Ben Newman
- **Year**: 2014–present
- **Key Findings & Contributions**:
  - Solves the problem of **preserving original code formatting** (comments, indentation, string quotes, trailing commas, line breaks) during AST transformations.
  - Implements **conservative printing**: when printing an AST, Recast re-uses the original source string for any AST subtrees that were *not* modified.
  - Only nodes that have been mutated, inserted, or moved are re-printed via pretty printer.
  - Uses `ast-types` for AST node traversal and structural type checking.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  const recast = require("recast");
  const ast = recast.parse(sourceCode, { parser: require("recast/parsers/babel") });

  recast.visit(ast, {
    visitJSXAttribute(path) {
      if (path.node.name.name === 'color') {
        path.node.value = recast.types.builders.stringLiteral('#3b82f6');
      }
      this.traverse(path);
    }
  });

  const output = recast.print(ast).code; // Preserves 100% untouched code & whitespace!
  ```
- **Benefit for Glide Visual Editor**:
  - **Critical for Glide Rule 1 (Source Code Integrity First)**: Ensures visual changes (e.g. color picker update or resize) only modify the exact target property/attribute in source code without touch-reformatting the rest of the developer's file.

---

### Source 7: jscodeshift — Meta's Codemod Engine
- **Title**: jscodeshift: Toolkit for running codemods on JavaScript/TypeScript codebases
- **URL**: https://github.com/facebook/jscodeshift
- **Authors**: Felix Kling et al. (Meta / Facebook)
- **Year**: 2015–present
- **Key Findings & Contributions**:
  - Combines Recast's conservative parser/generator with a jQuery-like fluent query API for AST manipulation.
  - Enables finding nodes by pattern, filtering, updating, replacing, or inserting nodes programmatically.
  - Multi-threaded execution via worker pools for running codemods across thousands of files simultaneously.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  module.exports = function(fileInfo, api) {
    const j = api.jscodeshift;
    return j(fileInfo.source)
      .find(j.JSXElement, { openingElement: { name: { name: 'Button' } } })
      .forEach(path => {
        j(path).find(j.JSXAttribute, { name: { name: 'variant' } })
          .replaceWith(j.jsxAttribute(j.jsxIdentifier('variant'), j.stringLiteral('primary')));
      })
      .toSource({ quote: 'single' });
  };
  ```
- **Benefit for Glide Visual Editor**:
  - Demonstrates declarative query/mutation patterns for batch transformations on JSX component nodes.

---

### Source 8: Magic-string — Zero-AST Fast Source Code Mutation
- **Title**: magic-string: Read, manipulate and transform strings with sourcemaps
- **URL**: https://github.com/rich-harris/magic-string
- **Authors**: Rich Harris (creator of Svelte & Rollup)
- **Year**: 2015–present
- **Key Findings & Contributions**:
  - Enables ultra-fast code modification via character index offsets (`update`, `overwrite`, `remove`, `appendLeft`, `insertRight`) without performing full AST re-parsing or re-generation.
  - Automatically computes high-precision VLQ source maps (v3) for modified strings.
  - Used heavily in Vite, Svelte compiler, and Rollup.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  import MagicString from 'magic-string';
  const s = new MagicString('export const color = "#000000";');
  s.overwrite(22, 29, '#3b82f6');
  console.log(s.toString()); // 'export const color = "#3b82f6";'
  console.log(s.generateMap({ hires: true }));
  ```
- **Benefit for Glide Visual Editor**:
  - **Ideal for Fluid Drag/Live Resizing & Color Picker Drag**: Allows Glide to update inline styles or CSS values in real-time during live mouse drag (60fps canvas performance) without running expensive AST parse-print passes on every mouse move frame!

---

### Source 9: Magicast — Programmatic Proxy-based AST Mutation
- **Title**: magicast: Programmatic modification of JavaScript / TypeScript files
- **URL**: https://github.com/unjs/magicast
- **Authors**: Pooya Parsa et al. (UnJS Team)
- **Year**: 2023–present
- **Key Findings & Contributions**:
  - Combines Babel AST parsing, Recast format-preserving generation, and Magic-string concepts into a Proxy-based JavaScript object API.
  - Allows mutating AST constructs using simple JS object properties (e.g. `mod.exports.default.bg = 'red'`).
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  import { parseModule } from 'magicast';
  const mod = parseModule(`export default { theme: { color: 'red' } }`);
  mod.exports.default.theme.color = 'blue';
  const { code } = mod.generate();
  ```
- **Benefit for Glide Visual Editor**:
  - Provides model inspiration for exposing clean property-setter APIs to visual canvas controls (e.g., props panel binding).

---

### Source 10: TypeScript Compiler API & Transformer Factories
- **Title**: TypeScript Compiler API and AST Transformation Pipeline
- **URL**: https://github.com/microsoft/TypeScript / https://ts-ast-viewer.com
- **Authors**: Anders Hejlsberg et al. (Microsoft)
- **Year**: 2014–present
- **Key Findings & Contributions**:
  - Provides `ts.SourceFile`, `ts.Node`, `ts.SyntaxKind`, `ts.transform`, `ts.factory`, and `ts.createPrinter`.
  - Transforms AST nodes using functional **Transformer Factory** pattern:
    - Immutable AST node update pattern: `ts.factory.updateJSXOpeningElement(...)` or `ts.factory.createJSXElement(...)`.
  - Visitors use bottom-up/top-down recursive tree traversal via `ts.visitEachChild`.
- **Relevant Code Patterns & Algorithms**:
  ```typescript
  import * as ts from 'typescript';
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      node = ts.visitEachChild(node, visitor, context);
      if (ts.isJSXAttribute(node) && node.name.text === 'className') {
        return ts.factory.updateJSXAttribute(node, node.name, ts.factory.createStringLiteral('px-4 py-2 bg-blue-500'));
      }
      return node;
    };
    return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  };
  ```
- **Benefit for Glide Visual Editor**:
  - Standard reference for type-safe TypeScript & TSX AST node inspection, prop extraction, and AST updates.

---

### Source 11: ESLint Architecture, ESTree Specification & ESQuery Selectors
- **Title**: ESLint Architecture, ESTree AST Specification & ESQuery
- **URL**: https://eslint.org/docs/latest/extend/custom-rules & https://github.com/estools/esquery
- **Authors**: Nicholas C. Zakas, ESTree Spec Contributors, ESQuery Authors
- **Year**: 2013–present
- **Key Findings & Contributions**:
  - Standardized **ESTree AST format** for JavaScript/JSX.
  - Uses **Visitor Pattern** with traversal entry (`JSXElement`) and exit (`JSXElement:exit`) events.
  - Uses **ESQuery** (CSS-like selectors for ASTs) to query nodes declaratively:
    - E.g., `JSXElement[openingElement.name.name="Button"] > JSXAttribute[name.name="onClick"]`.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  // ESQuery selector evaluation on ESTree
  const esquery = require('esquery');
  const matches = esquery(ast, 'JSXElement > JSXAttribute[name.name="style"]');
  ```
- **Benefit for Glide Visual Editor**:
  - Gives Glide a high-level query engine to locate target visual components in AST by selector (e.g. finding element at layer path or resolving component trees).

---

### Source 12: Prettier Architecture & Doc Builder Solver
- **Title**: Prettier: Opinionated Code Formatter Architecture
- **URL**: https://prettier.io/docs/en/technical-details.html
- **Authors**: Christopher Chedeau (vjeux), James Long, Prettier Core Team
- **Year**: 2016–present
- **Key Findings & Contributions**:
  - Converts parsed AST into Prettier **Doc IR** combinators (`concat`, `group`, `indent`, `line`, `ifBreak`, `breakParent`).
  - Layout engine computes exact line lengths and automatically formats nested JSX structures with proper multiline indentation and bracket alignment.
  - Solves comment attachment: reads leading/trailing comments from token stream and attaches them to nearby AST nodes before Doc IR printing.
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  const { builders: { group, indent, line, concat } } = require("prettier/doc");
  const doc = group(concat(["<div", indent(concat([line, 'className="card"'])), line, ">"]));
  ```
- **Benefit for Glide Visual Editor**:
  - Informs how visual drag-and-drop code generation must attach comments and preserve JSX formatting when creating multi-line nested layout blocks.

---

### Source 13: SWC & Oxc — Rust-Based High-Speed AST Parsers
- **Title**: SWC & Oxc: Next-Generation Rust JavaScript/TypeScript Toolchains
- **URL**: https://swc.rs & https://oxc.rs
- **Authors**: DongYong Kang (SWC), Boshen et al. (Oxc / VoidZero)
- **Year**: 2019–present
- **Key Findings & Contributions**:
  - High-performance native AST parsers written in Rust, outperforming JavaScript parsers (Acorn, Esprima) by 10x–40x.
  - **Oxc** uses custom **Arena Allocation** (`bumpalo`) for zero-overhead AST node creation and fast multi-pass traversal.
  - SWC provides AST manipulation NAPI bindings and Wasm modules for browser environments.
- **Comparison Matrix**:
  | Parser | Language | Speed | Incremental | Comment Attachment | Primary Use Case |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Tree-sitter** | C/Rust/Wasm | Ultra Fast | Yes ($O(\log N)$) | Native tokens | Live IDE editing / CST |
  | **Oxc** | Rust/Wasm | Blazing Fast (Arena) | Partial | High precision | Linter / Transformer / Bundler |
  | **SWC** | Rust/NAPI/Wasm | Extremely Fast | No | Native AST | Next.js / Transpilation |
  | **Recast / Babel** | JavaScript | Moderate | No | AST comments array | Codemods / Format Preservation |
  | **Acorn** | JavaScript | Lightweight | No | Token stream | Devtools / Micro-tools |
- **Benefit for Glide Visual Editor**:
  - Benchmark guide for selecting parser backends: Tree-sitter for visual canvas CST tracking; Recast/Magic-string for format-preserving disk writes.

---

### Source 14: Projectional Editing & Visual AST Editors
- **Title**: Projectional Editing and Language Workbenches
- **URL**: https://martinfowler.com/bliki/ProjectionalEditing.html
- **Authors**: Martin Fowler, Markus Voelter (JetBrains MPS)
- **Year**: 2008–present
- **Key Findings & Contributions**:
  - Defines **Projectional Editing**: editing the AST/Model directly through visual projections (graphics, drag-and-drop canvas, forms, code views) without an intermediate text parsing step.
  - Eliminates syntax errors by construction while editing.
  - Challenge: pure projectional editors feel unfamiliar to text-accustomed developers.
  - Solution (hybrid approach used by Glide): maintains dual synchronization between bidirectional visual canvas projection and standard underlying text AST/CST files.
- **Relevant Code Patterns & Algorithms**:
  - Dual model-view binding pattern:
    $$\text{Visual Canvas Event} \longrightarrow \text{CST Patch} \longrightarrow \text{Source Code File}$$
    $$\text{Source Code Edit} \longrightarrow \text{Incremental CST Reparse} \longrightarrow \text{Visual Canvas Re-render}$$
- **Benefit for Glide Visual Editor**:
  - Architecturally validates Glide's vision: Figma-like visual interaction layer acting as a direct projection over standard React/Vue/Svelte source ASTs.

---

### Source 15: Babel AST Engine (`@babel/parser`, `@babel/traverse`, `@babel/types`)
- **Title**: Babel Toolchain Architecture & AST Traversal Patterns
- **URL**: https://babeljs.io/docs/babel-traverse
- **Authors**: Sebastian McKenzie et al. (Babel Core Team)
- **Year**: 2014–present
- **Key Findings & Contributions**:
  - The industry standard for JavaScript/JSX AST parsing and traversal in web development.
  - `@babel/traverse` uses path wraps (`NodePath`) that provide contextual helper methods (`replaceWith`, `insertBefore`, `insertAfter`, `remove`, `findParent`).
  - `@babel/types` provides type guards (`isJSXElement`, `isIdentifier`) and AST node builder functions (`jsxElement(...)`).
- **Relevant Code Patterns & Algorithms**:
  ```javascript
  const traverse = require("@babel/traverse").default;
  const t = require("@babel/types");

  traverse(ast, {
    JSXOpeningElement(path) {
      if (path.node.name.name === 'div') {
        path.node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-glide-id'), t.stringLiteral('comp-123'))
        );
      }
    }
  });
  ```
- **Benefit for Glide Visual Editor**:
  - Essential for JSX node inspection, component scope analysis, and AST node construction in Glide adapter plugins.

---

## 2. Synthesis & Strategic Architectural Principles for Glide

Based on the 15 researched sources, the following technical strategies are established for Glide's AST visual editor engine:

1. **Dual-Layer Parser Pipeline**:
   - **Tree-sitter (CST)** for real-time visual canvas tracking, error tolerance, and instant node selection via S-expression queries.
   - **Recast + Babel / Magic-string** for non-destructive, format-preserving code updates during visual drag-and-drop edits.

2. **Throttled Live Resizing & Instant Writes**:
   - During active mouse drag (fluid resizing / color picking at 60fps), use **Magic-string** string slicing with offset ranges to update style attributes in memory without full AST re-parse.
   - On mouse release (drag commit), execute **Recast AST patch** for permanent, clean source file writes.

3. **AST Diffing for Visual Layer Rearrangement**:
   - Use **GumTree-inspired subtree matching** when users drag visual components across the layers panel to generate minimal AST `Move` / `Insert` / `Delete` edits without breaking surrounding component code.

4. **Wadler / Prettier IR for New Component Synthesis**:
   - When dropping new components from the UI library into the canvas, generate AST subtrees wrapped in Wadler-style Doc combinators to guarantee generated code matches user formatting settings.

5. **ESQuery AST Selectors**:
   - Utilize ESQuery selector patterns for resolving component trees and selecting target AST nodes directly from canvas UI clicks.
