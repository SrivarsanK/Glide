# Phase 2 Research: Vite Plugin & Source-Stamping

Research into implementing a Vite plugin that stamps JSX elements with their original source file coordinates (`data-cf-source="filepath:line:column"`) during development, and ensures they are excluded from production builds.

## 1. AST Source Mapping in Babel

Every JSX element in Babel's AST has a `loc` (location) property populated by the parser:
- `node.loc.start.line`: 1-based line number.
- `node.loc.start.column`: 0-based column number (we should add 1 to make it 1-based, or keep it 0-based as standard. Figma/IDE links usually prefer 1-based. Let's use 1-based for both line and column for consistency: `line:col+1`).

### Babel Plugin Visitor Pattern
To inject attributes:
```typescript
import { types as t } from '@babel/core';

export default function sourceStampingPlugin() {
  return {
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = state.file.opts.filename;
        if (!filename) return;

        // Skip node_modules or excluded folders
        if (filename.includes('node_modules')) return;

        const loc = path.node.loc;
        if (!loc) return;

        // Normalize path relative to project root
        const relativePath = getRelativePath(filename);

        const sourceVal = `${relativePath}:${loc.start.line}:${loc.start.column + 1}`;

        // Create data-cf-source attribute
        const attr = t.jsxAttribute(
          t.jsxIdentifier('data-cf-source'),
          t.stringLiteral(sourceVal)
        );

        path.node.attributes.push(attr);
      }
    }
  };
}
```

## 2. Vite Integration

A Vite plugin can hook into the `transform` lifecycle method:
- **Filter**: Only transform files with extension `.jsx`, `.tsx` (and potentially `.vue`, `.svelte` in future phases, but React/JSX is the focus for Phase 2).
- **Environment Check**: Check if the command is `serve` (development mode). If it is `build` (production mode), the plugin should return a no-op transform or skip entirely.

### Vite Plugin Structure
```typescript
import { Plugin } from 'vite';
import * as babel from '@babel/core';

export function glideSourceStamping(): Plugin {
  let isDev = false;

  return {
    name: 'vite-plugin-glide-source-stamping',
    
    configResolved(config) {
      isDev = config.command === 'serve';
    },

    transform(code, id) {
      if (!isDev) return null;

      // Only target JSX/TSX source files in the src directory
      if (!/\.[jt]sx$/.test(id) || id.includes('node_modules')) {
        return null;
      }

      const result = babel.transformSync(code, {
        filename: id,
        plugins: [
          // Inject our Babel plugin
          sourceStampingBabelPlugin
        ],
        sourceMaps: true,
        // Ensure TS and JSX are supported in parsing
        presets: [
          '@babel/preset-typescript'
        ]
      });

      return {
        code: result?.code ?? code,
        map: result?.map
      };
    }
  };
}
```

## 3. Validation Architecture

To verify the transformation:
1. **Unit Tests**:
   - Write tests using Vitest that run the Babel transform on a raw string of JSX and verify that `data-cf-source` is appended with correct coordinate mappings.
2. **Integration Tests**:
   - Run a mock Vite build in production mode and assert that `data-cf-source` is NOT present in the bundle.
   - Run a mock Vite server or build in dev mode and assert that it IS present.

## 4. Key Decisions
- **Path Normalization**: Source coordinates will store paths relative to the project root (e.g. `src/components/Button.tsx`) to keep them OS-independent and clean.
- **Production Stripping**: Done by configuration (Vite command checks) rather than parsing and removing existing attributes, avoiding build-time performance penalties.
