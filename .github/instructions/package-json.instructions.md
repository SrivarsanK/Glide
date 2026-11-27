---
applyTo: "**/package.json"
---

# package.json review checklist

Adapted (modified) from the `package_json` rules of [alibaba/open-code-review](https://github.com/alibaba/open-code-review) v1.14.4 (Apache-2.0).

- A newly added dependency uses `latest` or `*` instead of a version range. Only flag lines added in this change.
- The same package appears in both `dependencies` and `devDependencies`.
- A tool used in `scripts` (for example `vitest`, `tsc`, `rollup`) is not declared in `devDependencies`.
- In the root `overrides`, an entry for a direct dependency uses a fixed version instead of a `$name` reference (`"vite": "$vite"`). A fixed version makes npm fail with `EOVERRIDE` whenever the dependency is bumped, which stops Dependabot.
