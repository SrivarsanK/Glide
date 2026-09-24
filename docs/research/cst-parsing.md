# CST Parsing Research - Analysis

## Executive Summary

Concrete Syntax Trees (CSTs) and Lossless Syntax Trees (LSTs) represent the foundational architecture required for source-code-first visual editing. Traditional Abstract Syntax Trees (ASTs) discard non-semantic tokens—such as indentation, whitespace, comments, semicolons, and grouping parentheses—to streamline compiler optimization passes. However, in visual design environments like **Glide**, preserving 100% of developer formatting, comments, and stylistic nuances is a strict requirement. AST-based visual manipulation forces global code re-printing (e.g., via Prettier), which destroys existing formatting, strips inline comments, and causes massive unwanted git diffs across unmodified code regions.

Industry-standard compilers and tools have addressed this challenge through specialized tree representations. Microsoft's Roslyn introduced **Red-Green Trees** to combine persistent structural sharing with absolute parent-child tree navigation. Apple's SwiftSyntax established the **Token-Anchored Trivia Vector Model**, attaching leading and trailing non-semantic metadata directly to leaf tokens. Tree-sitter demonstrated logarithmic **Incremental Parsing** via GLR state reuse, while Recast and `@vue/compiler-sfc` proved that non-destructive transformation can be achieved through **Subtree Reprinting** and **Byte-Offset Splicing**.

For **Glide**, which enables real-time visual editing across React, Vue, Svelte, and HTML components, adopting a CST-driven architecture is critical. By combining a dual-layer Red-Green model (separating 60fps canvas facade state from immutable CST storage) with surgical source-slicing mutators, Glide can guarantee sub-millisecond visual updates without ever compromising developer source code integrity.

---

## Key Technical Findings

### CST vs AST Tradeoffs

Understanding the boundaries between Abstract Syntax Trees (AST), Concrete Syntax Trees (CST), and Lossless Syntax Trees (LST) is essential when selecting data structures for visual code editing.

| Dimension | Abstract Syntax Tree (AST) | Concrete Syntax Tree (CST) | Lossless Syntax Tree (LST) |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Semantic evaluation, compilation, optimization | Direct representation of grammar rules | Round-trip source refactoring & visual editing |
| **Syntax Tokens** | Discarded (commas, parens, braces removed) | Retained as grammar terminal nodes | Retained with exact character span ranges |
| **Trivia (Whitespace & Comments)** | Stripped or loosely attached | Retained in grammar or ignored | Fully preserved as leading/trailing trivia vectors |
| **Node Structure** | Compact semantic constructs (`IfStatement`) | Direct grammar rule productions | Semantic nodes anchored to token trivia |
| **Source Reconstruction** | Lossy; requires pretty-printer | Lossy unless explicitly extended | 100% exact round-trip (`print(parse(code)) === code`) |
| **Memory & Performance** | Minimal memory overhead | High verbosity, larger memory footprint | Optimized via Red-Green structural sharing |

#### When to Use Each Approach

* **Use AST when:** Building production compilers, type checkers, static analysis interpreters, or linter rules where formatting and whitespace are completely irrelevant to runtime semantics.
* **Use CST when:** Writing language parsers, syntax checkers, or grammars where every terminal symbol defined in the formal specification must be validated.
* **Use LST / Format-Preserving CST when:** Developing visual editors (Glide), automated refactoring engines, codemods, language servers (LSP), and IDE code tools where code must be manipulated without altering untouched lines, indentation, or developer comments.

---

### Lossless Parsing Techniques

Lossless parsing requires accounting for every byte in the input buffer, including non-code characters known as *trivia* (spaces, tabs, line breaks, block comments, and single-line comments).

```
   Source Text:    \n    // Button CTA\n    <Button color="blue">
                   |-------------------| |--------------------|
                   Token Leading Trivia     Leaf Token Syntax
```

#### 1. Trivia Anchoring Vector Model (SwiftSyntax Pattern)
* Non-semantic content is attached to leaf `TokenSyntax` nodes as `leadingTrivia` (preceding whitespace/comments) and `trailingTrivia` (following whitespace/comments).
* Non-terminal parent nodes (such as `JSXElement` or `FunctionDeclaration`) do not hold trivia directly; their text spans are derived from their first and last descendant child tokens.
* An `EOF` (End-of-File) token anchors all trailing comments and trailing newlines at the bottom of the source file, preventing comment loss when the final AST node is deleted.

#### 2. Explicit Trivia Nodes (sql-parser-cst Pattern)
* Treats whitespace and comments as first-class CST child nodes inside element arrays (`[Keyword, Whitespace, Identifier, Comment]`).
* While simpler to inspect sequentially, explicit trivia nodes complicate semantic traversals because every visitor must explicitly filter out trivia nodes before inspecting code logic.

#### 3. Fault-Tolerant Resilient Parsing (Biome / Rowan Pattern)
* Visual editing frequently catches code in incomplete or syntactically invalid intermediate states (e.g., a developer typing half an attribute in the code pane while the visual canvas is active).
* Resilient parsers emit `SyntaxError` wrapper nodes around unparseable token sequences without discarding surrounding code subtrees, keeping the visual editor canvas interactive even during active typing.

---

### Format-Preserving Transformations

Making visual changes to code (e.g., resizing an element, inserting a Tailwind class, or updating a prop) without destroying developer formatting requires non-destructive transformation techniques.

```
       Original Code Buffer
 [Unmodified Head] [Target Element Node] [Unmodified Tail]
         |                    |                   |
         v                    v                   v
 Direct String Copy    Surgical Reprint    Direct String Copy
```

#### 1. Selective Subtree Reprinting (Recast Algorithm)
* Instead of running a pretty-printer across the entire AST/CST, the engine tracks an `isModified` flag on every node.
* When serializing the tree back to code:
  * For **unmodified nodes**, the engine returns the exact substring slice from the original source file (`originalSource.slice(node.start, node.end)`).
  * For **modified nodes**, the engine re-prints only that specific subtree using localized formatting rules, leaving all surrounding sibling nodes byte-for-byte untouched.

#### 2. Single-File Component (SFC) Block Splicing (`magic-string` + Offsets)
* Frameworks like Vue and Svelte encapsulate `<template>`, `<script>`, and `<style>` blocks in a single file.
* By parsing block boundaries to obtain character range offsets (`loc.start.offset` ... `loc.end.offset`), visual edits targeting the visual markup layer slice and patch *only* the template region via `magic-string` mutations, guaranteeing that script imports, state logic, and styling blocks remain pristine.

#### 3. Immutable Node Mutation via `with_changes()` (LibCST Model)
* Tree modifications do not mutate existing nodes in place. Instead, mutating an attribute returns a shallow clone of the target node containing updated parameters while sharing unchanged child trivia structures.

---

### CST Libraries Comparison

The following table summarizes key technical properties of leading CST parsing libraries and frameworks:

| Library / System | Primary Language Target | Parsing Architecture | Mutability Model | Trivia Storage Mechanism | Incremental Parsing Support | Suitability for Glide JS Visual Canvas |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tree-sitter** | Multi-language (C, WASM, JS) | Incremental GLR Parser Generator | Immutable Tree with Edit API | Anonymous & Named CST Nodes | Logarithmic $O(\log N)$ Incremental Repair | **High** (Ideal for live canvas sync & instant CST query matching) |
| **Recast** | JavaScript / TypeScript | ESTree AST Wrapper | Mutable AST with Source Tracking | `leading` / `trailing` comment attachments | Source Slicing Fallback | **High** (Surgical JSX attribute & prop modifications) |
| **Roslyn** | C# / VB.NET | Hand-written Recursive Descent | Red-Green Dual Layer (Immutable/Facade) | Leading / Trailing Trivia Vectors | Structural Subtree Sharing | **Architecture Reference** (Model for Glide canvas state) |
| **SwiftSyntax** | Swift | LibSyntax / C++ Native Wrapper | Immutable Structural Tree | Structured `TriviaPiece` Vectors on Leaf Tokens | Incremental Parsing Support | **Design Blueprint** (Model for trivia anchoring) |
| **LibCST** | Python | CST Parser & Visitor Framework | Immutable (`with_changes`) | Explicit formatting fields on nodes | Full Tree Re-parsing | **Medium** (Python-only; design reference for codemods) |
| **Biome / Rowan** | JS / TS / CSS / JSON | Rust Lossless Parser (Roslyn-inspired) | Red-Green Tree (Rowan crate) | Trivia Tokens in Green Tree | High-speed full-file parsing | **High** (Future WASM engine for ultra-fast AST operations) |
| **Chevrotain** | JavaScript | Custom Building-Block Parser | JSON CST Tree | Custom Token Range Boundaries | Manual Re-parsing | **Medium** (Great for custom DSL/prop expression sub-parsers) |
| **sql-parser-cst** | SQL | Pure JS CST Parser | Mutable Array Items | Explicit Whitespace / Comment CST Nodes | Full Re-parse | **Low** (Domain-specific for SQL statements) |

---

### CST for Code Formatters

Code formatters interact with syntax trees using fundamentally different methodologies depending on their primary design goals:

```
  Traditional Formatter (Prettier):
  Source --> AST --> Intermediate Doc IR --> Global Re-Print (Destroys Formatting)

  CST Formatter (Biome / Rowan):
  Source --> Lossless Green Tree --> Layout IR --> Ultra-Fast Preserving Format

  Adaptive Formatter (CodeBuff):
  Source --> ANTLR4 CST --> ML KNN Style Model --> Contextual Format Actions
```

1. **Opinionated Global Formatting (Prettier):**
   * Prettier deliberately discards original formatting. It parses code into an AST, discards whitespace/formatting tokens, attaches comments using proximity heuristics, converts the AST into an intermediate Doc IR (`group()`, `indent()`, `concat()`), and outputs a completely standardized code string.
   * *Why it fails visual editors:* Destroys custom developer spacing, re-wraps lines unpredictably, and generates noisy git diffs on untouched lines.

2. **CST Layout Formatting (Biome / Rowan):**
   * Biome converts a lossless Green Tree directly into layout documents. Because the tree retains exact trivia tokens and error nodes, Biome formats code 10–100x faster than Prettier while maintaining full resilience against invalid syntax.

3. **Inverted Parser & Adaptive Formatting (CodeBuff):**
   * CodeBuff extracts ANTLR4 CSTs from target codebases and uses K-Nearest Neighbors (KNN) classification over CST node paths to infer developer-specific formatting preferences (indentation width, operator spacing, newline placement).
   * *Utility for Glide:* Enables Glide to automatically format newly inserted visual components so they match the surrounding file's formatting style without requiring manual developer configuration.

---

## Most Relevant Papers & Sources

### 1. Roslyn (.NET Compiler Platform) – Red-Green Tree Architecture
* **Source:** Microsoft Engineering (Eric Lippert et al.)
* **Key Concept:** Solves the core trade-off between immutable persistent data structures and parent-traversal performance by decoupling the syntax tree into two distinct representations:
  * **Green Layer:** Pure, context-free, immutable nodes that store relative width and trivia. Lacks parent pointers, enabling aggressive structural sharing across parse tree versions.
  * **Red Layer:** Short-lived facade nodes allocated on demand. Holds parent references and computes absolute byte positions by aggregating preceding green sibling widths.
* **Relevance:** Serves as the primary architectural blueprint for Glide's internal state management.

### 2. SwiftSyntax – Trivia & Full-Fidelity Syntax Trees
* **Source:** Apple & Swift Open Source Community
* **Key Concept:** Models non-semantic elements as strongly-typed `TriviaPiece` enum vectors attached directly to leaf `TokenSyntax` nodes (`leadingTrivia` / `trailingTrivia`). Guaranteed 100% round-trip fidelity through EOF trivia anchoring.
* **Relevance:** Direct blueprint for Glide's prop and attribute mutators.

### 3. Tree-sitter – Incremental CST Parsing System
* **Source:** Max Brunsfeld (GitHub)
* **Key Concept:** High-performance C/WASM incremental GLR parser. Tracks tree modifications via `ts_tree_edit` and re-parses changed buffers in $O(\log N)$ logarithmic time through subtree node reuse.
* **Relevance:** Powers Glide's real-time Web Worker parser, syncing live canvas interactions back to code.

### 4. Recast – Non-Destructive JavaScript Syntax Tree Transformer
* **Source:** Ben Newman
* **Key Concept:** Preserves source code layout by pairing AST modifications with a source-slicing reprint algorithm: `recast.print(node)` outputs original string slices for unmodified subtrees and re-prints only edited nodes.
* **Relevance:** Essential model for non-destructive JSX/HTML visual editing.

### 5. Biome (Rome) & Rowan – Rust Lossless Syntax Tree Architecture
* **Source:** Aleksey Kladov (rust-analyzer) & Biome Core Team
* **Key Concept:** High-speed Rust implementation of Roslyn-style Red-Green trees with resilient error recovery. Incomplete syntax creates `SyntaxError` nodes without invalidating surrounding AST nodes.
* **Relevance:** Model for resilient visual editing during active user typing.

### 6. Vue SFC Compiler & Svelte Compiler (`magic-string` Range Splicing)
* **Source:** Evan You (Vue) & Rich Harris (Svelte)
* **Key Concept:** Single File Component parsers expose precise character offsets (`loc.start.offset`, `loc.end.offset`) for template, script, and style blocks, allowing targeted string splicing using `magic-string`.
* **Relevance:** Blueprint for Glide's Vue (`.vue`) and Svelte (`.svelte`) visual editor adapters.

### 7. RefDiff 2.0: Multi-Language Refactoring Detection
* **Source:** Danilo Silva, Nikolaos Tsantalis, Marco Tulio Valente (IEEE TSE 2020)
* **Key Concept:** Uses language-agnostic Code Structure Trees (CST) and bipartite graph matching to track code node identity across structural movements and renames.
* **Relevance:** Enables Glide to maintain visual selection highlight bounds while elements are being dragged and reordered in the component layer tree.

### 8. Auto-SPT: Automating Semantic Preserving Transformations
* **Source:** Q. Zhang et al. (arXiv 2025)
* **Key Concept:** Formally proves semantic-preservation invariants for AST/CST code rewrite rules, ensuring transformations do not modify control flow graphs or variable scoping.
* **Relevance:** Guarantees visual editor mutations (resizing, Tailwind class updates, prop editing) never introduce runtime JavaScript bugs.

---

## Relevance to Glide

### Direct Applications

1. **Dual-Layer Canvas View Model (Red-Green Pattern):**
   * **Canvas Drag Facade (Red Layer):** Live 60fps drag-and-drop operations (resizing, repositioning) update light visual canvas facade properties without triggering continuous AST re-parsing or disk writes on every mouse frame.
   * **Source Tree Storage (Green Layer):** When the drag operation commits (on mouse release), the updated layout dimensions update the underlying immutable Green CST node, triggering a single surgical source write.

2. **JSX/HTML Component Prop & Class Mutator:**
   * Modifying Tailwind classes or inline styles targets only the specific attribute token values.
   * Existing leading indentation and trailing line comments surrounding the element remain 100% preserved.

3. **Framework Adapter Isolation (React, Vue, Svelte):**
   * Visual canvas edits isolate mutations to character ranges belonging strictly to the render/template region.
   * JavaScript import statements, component state, script setup blocks, and CSS styles remain byte-for-byte untouched.

---

### Library Recommendation

#### Recommended Solution: Hybrid Engine Strategy

```
                  +-----------------------------------+
                  |        Glide Engine Core          |
                  +-----------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
 [Tree-sitter WASM Engine]                        [Recast / Magic-String Engine]
 - Fast incremental parsing                       - Non-destructive JSX modifications
 - Real-time canvas node queries                  - Surgical subtree re-printing
 - Logarithmic re-parsing on keystroke            - Byte-offset string splicing
```

No single existing library satisfies all of Glide's visual editing requirements out of the box:
* **Tree-sitter** excels at ultra-fast incremental parsing and query matching, but lacks an ergonomic format-preserving JS AST mutation and codemod API.
* **Recast** excels at AST-driven JS/JSX non-destructive transformations, but lacks logarithmic incremental parsing for live 60fps canvas dragging.

**Recommendation:** Glide should deploy a **Hybrid Parsing & Transformation Architecture**:
1. Use **Tree-sitter WASM** in a Web Worker as the *Query & Boundary Indexer*. It incrementally parses source code as the user edits, providing sub-millisecond node lookup, structural validation, and canvas element bounding matching.
2. Use **Recast / `@babel/parser` with `magic-string`** as the *Surgical Transformation Mutator*. When visual edits commit, Recast and `magic-string` execute pinpoint string splicing on target node offsets, maintaining absolute source code integrity.

---

### Future Considerations

* **Biome WASM Integration:** As Biome's JavaScript/TypeScript API matures, replacing Babel/Recast with Biome WASM will unlock 10–50x faster full-file CST mutations directly in Rust/WASM.
* **CodeBuff ML Layout Inference:** Implement lightweight spacing/indentation classifiers so when users drag components from a UI library onto the canvas, Glide automatically matches the target project's code formatting style.

---

## Implementation Roadmap

```
+-----------------------------------------------------------------------------------+
| Phase 1: Core CST Data Structures & Red-Green Facade Architecture                 |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 2: Surgical Mutator Engine (Recast + Magic-String for React/Vue/Svelte)     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 3: Incremental Web Worker Parser (Tree-sitter WASM Synchronization)        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Phase 4: Structural Layer Rearrangement & RefDiff Alignment                       |
+-----------------------------------------------------------------------------------+
```

### Phase 1: Core CST Data Structures & Red-Green Facade Architecture
* Implement `GreenNode` and `RedNode` TypeScript data structures for internal syntax tree representation.
* Establish `TokenSyntax` and `TriviaVector` schemas supporting `.leadingTrivia` and `.trailingTrivia` (`spaces`, `tabs`, `newlines`, `comments`).
* Build parent-child offset calculators (`AbsolutePosition = Parent.AbsolutePosition + PrecedingSibling.Width`).

### Phase 2: Surgical Mutator Engine (React, Vue, Svelte)
* Integrate `magic-string` and Recast for range-restricted source transformations.
* Build target attribute/prop mutator functions (`updateJSXProp`, `updateTailwindClass`, `updateInlineStyle`).
* Implement block isolation handlers for Vue (`@vue/compiler-sfc`) and Svelte (`@svelte/compiler`) using `loc.start.offset` boundaries.

### Phase 3: Incremental Web Worker Parser
* Package `tree-sitter` WASM into a background Web Worker.
* Wire up `ts_tree_edit` to send byte edits from code editor / canvas actions to the worker thread.
* Implement sub-millisecond element node lookup via Tree-sitter S-expression queries.

### Phase 4: Structural Layer Rearrangement & RefDiff Alignment
* Implement element reordering algorithms (move layer up/down, push behind, wrap in div).
* Build node identity tracking (based on RefDiff 2.0 bipartite graph matching) to preserve visual selection highlights during layout updates.

---

## Code Patterns & Snippets

### Pattern 1: Red-Green Tree Architecture (Roslyn / Biome Model)

```typescript
// Green Layer: Immutable, context-free, stores relative width and trivia
interface GreenNode {
  kind: string;
  width: number;
  leadingTriviaWidth: number;
  trailingTriviaWidth: number;
  children: (GreenNode | GreenToken)[];
}

interface GreenToken {
  kind: string;
  text: string;
  width: number;
  leadingTrivia: TriviaPiece[];
  trailingTrivia: TriviaPiece[];
}

type TriviaPiece = 
  | { kind: 'whitespace'; text: string }
  | { kind: 'newline'; text: string }
  | { kind: 'comment'; text: string };

// Red Layer: Demand-allocated facade for visual canvas with absolute position
class RedNode {
  constructor(
    public readonly green: GreenNode,
    public readonly parent: RedNode | null,
    public readonly absoluteOffset: number
  ) {}

  get children(): RedNode[] {
    let currentOffset = this.absoluteOffset;
    return this.green.children.map((childGreen) => {
      const childRed = new RedNode(
        childGreen as GreenNode,
        this,
        currentOffset
      );
      currentOffset += childGreen.width;
      return childRed;
    });
  }
}
```

---

### Pattern 2: SwiftSyntax-Style Token Trivia Anchoring

```typescript
interface TokenSyntax {
  tokenKind: 'JSXIdentifier' | 'StringLiteral' | 'Equals' | 'EOF';
  value: string;
  leadingTrivia: TriviaPiece[];
  trailingTrivia: TriviaPiece[];
}

// Surgical token value replacement while preserving surrounding trivia
function updateTokenValue(
  token: TokenSyntax,
  newValue: string
): TokenSyntax {
  return {
    ...token,
    value: newValue,
    // Original leading and trailing whitespace/comments are kept intact!
    leadingTrivia: [...token.leadingTrivia],
    trailingTrivia: [...token.trailingTrivia],
  };
}
```

---

### Pattern 3: Recast Source-Slicing Subtree Reprinting

```javascript
import * as recast from 'recast';

// Parse code while building source position maps
const code = `
// Important CTA Button
<Button color="blue" onClick={handleClick}>
  Click Me
</Button>
`;

const ast = recast.parse(code, {
  parser: require('recast/parsers/babel'),
});

// Mutate specific node (e.g. change color prop value)
recast.visit(ast, {
  visitJSXAttribute(path) {
    if (path.node.name.name === 'color') {
      path.node.value = recast.types.builders.stringLiteral('red');
    }
    this.traverse(path);
  },
});

// Reprint: Only the modified JSX attribute is re-printed;
// the comment, indentation, and surrounding tags are sliced verbatim from source!
const output = recast.print(ast).code;
```

---

### Pattern 4: Tree-sitter WASM Incremental Edit & Parse

```javascript
import Parser from 'web-tree-sitter';

async function initIncrementalParser() {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Parser.Language.load('tree-sitter-javascript.wasm');
  parser.setLanguage(Lang);

  let tree = parser.parse('const buttonColor = "blue";');

  // Perform incremental edit notification (e.g. replacing "blue" with "red")
  tree.edit({
    startIndex: 21,
    oldEndIndex: 25,
    newEndIndex: 24,
    startPosition: { row: 0, column: 21 },
    oldEndPosition: { row: 0, column: 25 },
    newEndPosition: { row: 0, column: 24 },
  });

  // Re-parse in O(log N) time by re-using unchanged subtrees
  const updatedCode = 'const buttonColor = "red";';
  const newTree = parser.parse(updatedCode, tree);
  return newTree;
}
```

---

### Pattern 5: Framework SFC Block Slicing (`magic-string` + Offsets)

```typescript
import MagicString from 'magic-string';
import { parse as parseVueSFC } from '@vue/compiler-sfc';

const sfcSource = `
<template>
  <div class="old-class">
    <h1>Hello World</h1>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
`;

// Parse SFC block offsets
const { descriptor } = parseVueSFC(sfcSource);
const templateOffsetStart = descriptor.template.loc.start.offset;
const templateOffsetEnd = descriptor.template.loc.end.offset;

// Apply magic-string replacement strictly within template bounds
const s = new MagicString(sfcSource);
const templateContent = descriptor.template.content;
const updatedTemplate = templateContent.replace('old-class', 'new-class bg-blue-500');

s.overwrite(templateOffsetStart, templateOffsetEnd, updatedTemplate);

// Result: <script> block and all formatting outside <template> remain 100% untouched
const finalCode = s.toString();
```
