# AST Explorer — Complete Resource for Glide Coding Agent

## What This Document Is

This document tells the coding agent everything it needs to know about AST Explorer
and how to use it while building Glide. AST Explorer is a development aid, not a
runtime dependency. It is never imported or installed in the Glide package.

---

## 1. What AST Explorer Is

AST Explorer (https://astexplorer.net) is a browser-based tool that parses source code
and displays the resulting Abstract Syntax Tree (AST) in real time. You paste code on
the left, select a parser from the dropdown, and the parsed tree appears on the right.
Clicking any node in the tree highlights the corresponding source text, and vice versa.

It also has a Transform panel where you can write a Babel plugin live and see it applied
to the input code immediately — no build step, no file system.

---

## 2. Why Glide Uses It

Glide's core write-back engine reads source files, parses them to ASTs, locates specific
nodes by line and column, mutates those nodes, and writes the result back. To write this
correctly you must know:

- Exactly which node type wraps a JSX element's opening tag
- Exactly where className/class attributes sit in the tree
- Exactly what `node.start`, `node.end`, `node.loc.start.line`, `node.loc.start.column`
  contain and whether they are character offsets or line/col pairs
- Exactly how styled-components template literals are structured
- Exactly how Vue SFC template ASTs differ from JSX ASTs

AST Explorer answers all of these questions in seconds by letting you paste real code
and inspect the live tree. Without it, you are guessing at node shapes from documentation,
which causes bugs in the write-back engine.

---

## 3. The URL

https://astexplorer.net

No account needed. No install. Opens directly in browser.

---

## 4. Parser Selection — Which Parser to Use for Each Glide File Type

This is the most important configuration step. The parser dropdown is at the top of the
page. Select the correct parser before reading any tree output.

### JSX / TSX (React adapter)
- Parser: **@babel/parser**
- Transform: **babelv7** (when writing Babel plugins)
- Settings to enable: click the settings gear next to the parser name and check:
  - `jsx` — required for JSX syntax
  - `typescript` — required for .tsx files
  - `classProperties` — for class-based components
  - `decorators-legacy` — if the project uses decorators

### Vue SFC (.vue files)
- Parser: **@vue/compiler-dom** or **vue-template-compiler**
- Use `@vue/compiler-dom` for Vue 3 projects
- Use `vue-template-compiler` for Vue 2 projects
- Paste only the `<template>` block content, not the full SFC, for cleaner output

### Svelte (.svelte files)
- Parser: **svelte** (listed as "svelte" in the parser dropdown)
- Paste the full .svelte file content

### Plain HTML
- Parser: **parse5**
- This produces an HTML AST, not a JS AST — node types are different

### Plain CSS / SCSS
- Parser: **postcss** (for CSS files edited by the CSS Modules adapter)
- Node types here are Rule, Declaration, AtRule — not JS nodes

### TypeScript only (no JSX)
- Parser: **@babel/parser** with only `typescript` plugin enabled, not `jsx`

---

## 5. The Transform Panel — Writing Babel Plugins Live

In the toolbar at the top of AST Explorer, enable the **Transform** toggle. A third
panel appears at the bottom right showing the transformed output.

Select **babelv7** as the transform engine.

You can now write your Babel plugin code in the bottom-left panel and see it applied to
the input code in real time. This is the primary way to develop and test
`packages/babel-plugin/src/index.ts` before wiring it into the Vite plugin.

### Template for a Babel plugin in the Transform panel

```javascript
export default function(babel) {
  const { types: t } = babel;
  return {
    visitor: {
      JSXOpeningElement(path, state) {
        // Your plugin logic here
        // path.node is the JSXOpeningElement AST node
        // path.node.loc.start.line is the 1-indexed line number
        // path.node.loc.start.column is the 0-indexed column number
        // path.node.attributes is an array of JSXAttribute nodes
      }
    }
  };
}
```

### Testing the data-gl-source stamp plugin

Paste this input JSX:

```jsx
function Card() {
  return (
    <div className="card">
      <h1>Title</h1>
      <p>Body text</p>
    </div>
  );
}
```

Write the plugin in the transform panel and verify the output contains:

```jsx
<div className="card" data-gl-source="unknown:3:4">
```

The file path will show as "unknown" in AST Explorer since there is no real file path.
That is expected. In the real Vite plugin, `state.filename` provides the actual path.

---

## 6. Critical Node Types for the Glide React Adapter

When building `packages/adapters/react/src/index.ts`, these are the exact node types
and property paths you need. Verify each one in AST Explorer before using it in code.

### JSXOpeningElement

This is the node that wraps the opening tag of any JSX element.

```
JSXOpeningElement {
  name: JSXIdentifier { name: "div" }
  attributes: [
    JSXAttribute { ... },
    JSXAttribute { ... }
  ]
  loc: {
    start: { line: 3, column: 4 }   // 1-indexed line, 0-indexed column
    end: { line: 3, column: 28 }
  }
  start: 42    // character offset from start of file
  end: 66      // character offset from start of file
}
```

⛔ Do NOT confuse JSXOpeningElement with JSXElement. JSXElement wraps the entire
element including children and closing tag. JSXOpeningElement is just the opening tag.
The Babel plugin visitor must target `JSXOpeningElement`, not `JSXElement`.

### JSXAttribute with a string value (className="flex ml-4")

```
JSXAttribute {
  name: JSXIdentifier { name: "className" }
  value: StringLiteral {
    value: "flex ml-4"
    start: 50
    end: 61
  }
}
```

To update this: mutate `attribute.value.value` (the string content).
The `start` and `end` on StringLiteral are character offsets for the entire
quoted string including the quote characters.

### JSXAttribute with an expression value (className={styles.card})

```
JSXAttribute {
  name: JSXIdentifier { name: "className" }
  value: JSXExpressionContainer {
    expression: MemberExpression {
      object: Identifier { name: "styles" }
      property: Identifier { name: "card" }
    }
  }
}
```

This form appears with CSS Modules. The write-back logic must handle both string
and expression forms. Check `attribute.value.type` to branch:

```typescript
if (attribute.value.type === 'StringLiteral') {
  // Tailwind / plain class string — mutate attribute.value.value
} else if (attribute.value.type === 'JSXExpressionContainer') {
  // CSS Modules / dynamic className — different write strategy
}
```

### JSXAttribute with an object value (style={{ marginLeft: 16 }})

```
JSXAttribute {
  name: JSXIdentifier { name: "style" }
  value: JSXExpressionContainer {
    expression: ObjectExpression {
      properties: [
        ObjectProperty {
          key: Identifier { name: "marginLeft" }
          value: NumericLiteral { value: 16 }
        }
      ]
    }
  }
}
```

To add or update an inline style property: find the ObjectProperty with the matching
key name and mutate its value, or add a new ObjectProperty if it does not exist.

### The loc vs start/end distinction

This is a common source of bugs. Verify in AST Explorer:

- `node.loc.start.line` — 1-indexed line number (use for matching data-gl-source)
- `node.loc.start.column` — 0-indexed column number (use for matching data-gl-source)
- `node.start` — character offset from the beginning of the file (use for range replacement)
- `node.end` — character offset from the beginning of the file (use for range replacement)

The range replacement in `packages/ast-writer/src/index.ts` uses `node.start` and
`node.end`, not `loc`. The `data-gl-source` stamp format uses `loc.start.line` and
`loc.start.column`. These are different numbers. Never mix them up.

---

## 7. Critical Node Types for the Vue Adapter

When building `packages/adapters/vue/src/index.ts`, paste a .vue file's template
block into AST Explorer with the `@vue/compiler-dom` parser selected.

### Vue template element node

```
ElementNode {
  tag: "div"
  props: [
    AttributeNode | DirectiveNode
  ]
  children: [ ... ]
  loc: {
    start: { line: 2, column: 2, offset: 12 }
    end: { line: 4, column: 8, offset: 67 }
  }
}
```

Note: Vue uses `loc.start.offset` for character positions, not a separate `start`
property like Babel. Use `loc.start.offset` and `loc.end.offset` for range replacement
in the Vue adapter.

### Vue class attribute (static: class="flex ml-4")

```
AttributeNode {
  name: "class"
  value: SimpleExpressionNode {
    content: "flex ml-4"
    loc: { start: { offset: 18 }, end: { offset: 29 } }
  }
}
```

### Vue class binding (dynamic: :class="styles.card")

```
DirectiveNode {
  name: "bind"
  arg: SimpleExpressionNode { content: "class" }
  exp: SimpleExpressionNode { content: "styles.card" }
}
```

Check `prop.type` to distinguish: AttributeNode = 6, DirectiveNode = 7 in Vue's
compiler constants.

---

## 8. Critical Node Types for the Styled Components Adapter

When building styled-components write-back, paste this into AST Explorer with
`@babel/parser` + `jsx` plugin:

```javascript
const Card = styled.div`
  margin-left: 16px;
  padding: 8px;
  color: #333;
`
```

The AST will show:

```
VariableDeclaration {
  declarations: [
    VariableDeclarator {
      id: Identifier { name: "Card" }
      init: TaggedTemplateExpression {
        tag: MemberExpression {
          object: Identifier { name: "styled" }
          property: Identifier { name: "div" }
        }
        quasi: TemplateLiteral {
          quasis: [
            TemplateElement {
              value: {
                raw: "\n  margin-left: 16px;\n  padding: 8px;\n  color: #333;\n"
                cooked: "\n  margin-left: 16px;\n  padding: 8px;\n  color: #333;\n"
              }
            }
          ]
        }
      }
    }
  ]
}
```

The CSS string lives inside `quasi.quasis[0].value.raw`. To update a property,
parse this string with postcss, update the declaration, and write the result back
into `quasi.quasis[0].value.raw` and `.cooked`.

---

## 9. Verifying the data-gl-source Stamp Format

Before writing the Babel plugin, verify the exact loc format by pasting this into
AST Explorer with `@babel/parser` + `jsx`:

```jsx
<div className="card">
  <h1>Hello</h1>
</div>
```

Click the `<div` opening tag. In the right panel you will see:

```
JSXOpeningElement
  loc:
    start:
      line: 1       ← use this for the line number in data-gl-source
      column: 0     ← use this for the column number in data-gl-source
    end:
      line: 1
      column: 22
  start: 0          ← character offset, used for range replacement
  end: 22
```

The `data-gl-source` attribute value format is: `"{relativePath}:{line}:{column}"`
using `loc.start.line` (1-indexed) and `loc.start.column` (0-indexed).

---

## 10. Verifying Range Replacement Safety

The non-destructive write-back in `packages/ast-writer/src/index.ts` splices:

```typescript
const patched =
  originalSource.slice(0, node.start) +
  regeneratedNodeString +
  originalSource.slice(node.end)
```

To verify this is correct for a specific node type, use AST Explorer to find the
`start` and `end` values of that node, then manually verify:

```
originalSource.slice(0, node.start)  →  everything before the node
regeneratedNodeString                →  the mutated node text
originalSource.slice(node.end)       →  everything after the node
```

The concatenated result should equal the original source except for the changed node.

⛔ Do NOT use `node.loc.start.offset` from Vue with Babel's `node.start` — they are
the same concept but accessed differently per parser. Verify which property name
the parser uses before writing any range replacement logic.

---

## 11. How to Find a Node by Line and Column

The `resolveNode` method in each framework adapter must find an AST node at a specific
`(line, col)` position from the `data-gl-source` attribute. Verify the lookup logic
in AST Explorer by:

1. Pasting the component source code
2. Clicking the element at the target line and column
3. Confirming which node type is highlighted in the tree
4. Reading the exact `loc.start.line` and `loc.start.column` values shown

The lookup condition in the React adapter is:

```typescript
if (
  node.type === 'JSXOpeningElement' &&
  node.loc.start.line === targetLine &&
  node.loc.start.column === targetCol
) {
  return node
}
```

Verify this matches what AST Explorer shows for your test component before running it.

---

## 12. Useful Paste Examples for Development

Copy these into AST Explorer while building Glide to verify node shapes:

### Tailwind className string
```jsx
<div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg">
```

### Tailwind className with responsive prefix
```jsx
<div className="flex sm:flex-row md:gap-8 lg:p-12">
```

### Inline style object
```jsx
<div style={{ marginLeft: 16, paddingTop: 8, backgroundColor: '#fff' }}>
```

### CSS Modules className
```jsx
<div className={styles.card}>
```

### Combined className (clsx / cn pattern)
```jsx
<div className={cn('flex', isActive && 'bg-blue-500', styles.card)}>
```
⛔ This form requires special handling — the write-back cannot simply swap a class
string. For cn/clsx patterns, fall back to inline style write-back mode.

### Styled component definition
```javascript
const HeroSection = styled.section`
  display: flex;
  flex-direction: column;
  padding: 48px 24px;
`
```

### Component with data-gl-source stamp (after Babel transform)
```jsx
<div className="card" data-gl-source="src/components/Card.jsx:3:4">
```

---

## 13. Common Mistakes to Verify in AST Explorer

Use AST Explorer to check for these before finalizing any adapter code:

| Mistake | How to verify |
|---|---|
| Targeting JSXElement instead of JSXOpeningElement | Paste JSX, click the tag, check the highlighted node type |
| Using loc.start.offset instead of node.start in Babel | Check that Babel nodes have `.start` not `.loc.start.offset` |
| Using node.start instead of loc.start.offset in Vue | Check that Vue nodes use `.loc.start.offset` |
| Forgetting that line numbers are 1-indexed | Paste code, click line 3, verify loc.start.line === 3 not 2 |
| Forgetting that column numbers are 0-indexed | Click a tag starting at column 4, verify loc.start.column === 4 not 5 |
| Assuming className is always a StringLiteral | Paste className={...} form and verify it is JSXExpressionContainer |
| Assuming attributes is always a flat array | Paste spread attributes {...props} and check for JSXSpreadAttribute |

---

## 14. AST Explorer Is Never a Runtime Dependency

AST Explorer is used only during development to inspect node shapes, write plugins,
and debug the write-back engine. It is:

- ❌ Never imported in any Glide package
- ❌ Never listed in any package.json dependency
- ❌ Never called at runtime
- ✅ Only used by the developer in a browser tab while writing code

---

## 15. Quick Reference: Parser → Package → Glide Adapter

| AST Explorer Parser | npm Package Used in Glide | Glide Adapter File |
|---|---|---|
| @babel/parser | @babel/parser @babel/traverse @babel/generator | packages/adapters/react/src/index.ts |
| @vue/compiler-dom | @vue/compiler-sfc | packages/adapters/vue/src/index.ts |
| svelte | svelte/compiler | packages/adapters/svelte/src/index.ts |
| parse5 | parse5 | packages/adapters/html/src/index.ts |
| postcss | postcss | packages/ast-writer/src/style-writer.ts (CSS Modules) |

The AST Explorer parser and the npm package are different things. AST Explorer uses
the same underlying parsers but wraps them in its own interface. The node shapes are
identical — that is why AST Explorer is useful for verifying what the npm package will
produce.

---

*End of AST Explorer resource — for use by Glide coding agent only*
