---
applyTo: "**/*.{ts,js,tsx,jsx,mjs,cjs,mts,cts}"
---

# TypeScript and JavaScript review checklist

Adapted (modified) from the `ts_js_tsx_jsx` rules of [alibaba/open-code-review](https://github.com/alibaba/open-code-review) v1.14.4 (Apache-2.0).

## Typos
- Misspelled variable, function, component or prop names.
- Misspellings in log or error messages that make them harder to read.

## Dead code
- Code that can never run: a branch whose condition is always false, code after a `return`.
- Variables that are declared but never read.
- Large blocks of commented-out code with no reason given.

## Code quality
- **Duplication:** shared logic that should be extracted.
- **Comments:** complex logic should explain why; obvious code needs no comment.
- **Hard-coded values:** URLs, ports or magic numbers that belong in a constant or config.
- **`var`:** use `let` or `const`. Exception: the injected browser scripts in `bridge.ts`, `ws-server.ts` and `editor-html.ts`.
- **Equality:** use `===` and `!==`, not `==` and `!=`.
- **`any`:** a new `any` needs a comment saying why.
- **Null checks:** check before reading or destructuring a value that can be missing.
- **Ternaries:** no nested ternary expressions.

## React (in `.tsx` and `.jsx` components)
- Hooks only at the top level of React functions.
- `useEffect` has correct dependencies and cleans up after itself.
- No side effects during render (API calls, DOM changes).
- `React.memo`, `useMemo` and `useCallback` only where they measurably help.
- No component declared inside another component.

## Async code
- Async functions handle their errors, with messages a person can act on.
- Prefer `async`/`await` over promise chains and callbacks.
- Independent async work in a loop runs with `Promise.all`; dependent work runs in sequence.

## Security
- User input is escaped before it reaches the DOM.
- No `innerHTML` with page- or user-controlled data; use `textContent` or sanitize.
- No `eval()`, `Function()` or string arguments to `setTimeout`/`setInterval`.
- No `document.write()`.
- No API keys, tokens or other secrets in code.
- No changes to built-in prototypes such as `Array.prototype` or `Object.prototype`.
