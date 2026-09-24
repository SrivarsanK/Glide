/**
 * resolve.ts — Component definition resolver for Glide.
 *
 * Traces a component identifier (e.g. "Button" or "Card.Title") back to its
 * original definition coordinates (file, line, column).
 *
 * Resolution precedence:
 *   1. Local definition in current file (function/const/class)
 *   2. Import statement in current file (default, named, or namespace import)
 *      - Traces relative imports (./Button, ../Button)
 *      - Traces aliased imports (@/components/Button, ~/components/Button)
 *      - Resolves target AST to find exact export/declaration line
 *      - Handles Vue SFC, Svelte, and Astro components
 *   3. Project ComponentRegistry fallback (glide-components.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseBabel, type ParseResult } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { ComponentDefinition } from './types.js';

const traverse = (_traverse as any).default ?? _traverse;

export interface ResolveComponentOptions {
  /** Optional source code of current file (read from disk if omitted) */
  sourceCode?: string;
  /** Absolute or relative path to current file */
  filepath: string;
  /** Name of the component tag, e.g. "Button" or "Header.Title" */
  componentName: string;
  /** Optional project root directory (defaults to directory containing package.json or filepath) */
  projectRoot?: string;
}

const CANDIDATE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.astro'];
const INDEX_FILES = [
  'index.tsx',
  'index.jsx',
  'index.ts',
  'index.js',
  'index.vue',
  'index.svelte',
  'index.astro'
];

function findProjectRoot(startDir: string): string {
  let cur = path.resolve(startDir);
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(startDir);
}

function resolveFileCandidate(basePath: string): string | null {
  if (fs.existsSync(basePath)) {
    try {
      const stat = fs.statSync(basePath);
      if (stat.isFile()) return basePath;
      if (stat.isDirectory()) {
        for (const idx of INDEX_FILES) {
          const idxPath = path.join(basePath, idx);
          if (fs.existsSync(idxPath) && fs.statSync(idxPath).isFile()) {
            return idxPath;
          }
        }
      }
    } catch {}
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    const withExt = basePath + ext;
    if (fs.existsSync(withExt)) {
      try {
        if (fs.statSync(withExt).isFile()) return withExt;
      } catch {}
    }
  }

  // Directory index check
  for (const idx of INDEX_FILES) {
    const dirIdx = path.join(basePath, idx);
    if (fs.existsSync(dirIdx)) {
      try {
        if (fs.statSync(dirIdx).isFile()) return dirIdx;
      } catch {}
    }
  }

  return null;
}

function resolveImportPath(
  specifier: string,
  fromFile: string,
  projectRoot: string
): string | null {
  // Relative imports
  if (specifier.startsWith('.')) {
    const dir = path.dirname(fromFile);
    return resolveFileCandidate(path.resolve(dir, specifier));
  }

  // Path alias imports: @/ or ~/
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    const subPath = specifier.slice(2);
    // Try <root>/src/<subPath>
    const inSrc = resolveFileCandidate(path.resolve(projectRoot, 'src', subPath));
    if (inSrc) return inSrc;
    // Try <root>/<subPath>
    const inRoot = resolveFileCandidate(path.resolve(projectRoot, subPath));
    if (inRoot) return inRoot;
  }

  // Try direct relative from src or projectRoot
  const directSrc = resolveFileCandidate(path.resolve(projectRoot, 'src', specifier));
  if (directSrc) return directSrc;

  return null;
}

function findExportCoordinatesInFile(
  targetFile: string,
  targetExport: string
): { line: number; column: number; exportType: 'default' | 'named' | 'sfc' } {
  const ext = path.extname(targetFile).toLowerCase();
  if (ext === '.vue' || ext === '.svelte' || ext === '.astro' || ext === '.html') {
    return { line: 1, column: 0, exportType: 'sfc' };
  }

  let code: string;
  try {
    code = fs.readFileSync(targetFile, 'utf-8');
  } catch {
    return { line: 1, column: 0, exportType: targetExport === 'default' ? 'default' : 'named' };
  }

  let ast: ParseResult<File>;
  try {
    ast = parseBabel(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch {
    return { line: 1, column: 0, exportType: targetExport === 'default' ? 'default' : 'named' };
  }

  let foundLoc: { line: number; column: number } | null = null;
  let resolvedExportType: 'default' | 'named' = targetExport === 'default' ? 'default' : 'named';

  if (targetExport === 'default') {
    traverse(ast, {
      ExportDefaultDeclaration(p: any) {
        const decl = p.node.declaration;
        const loc = (decl.loc ?? p.node.loc)?.start;
        if (loc && !foundLoc) {
          foundLoc = { line: loc.line, column: loc.column };
        }
      }
    });
  } else if (targetExport === '*') {
    return { line: 1, column: 0, exportType: 'named' };
  } else {
    // Look for ExportNamedDeclaration
    traverse(ast, {
      ExportNamedDeclaration(p: any) {
        const decl = p.node.declaration;
        if (decl) {
          if (decl.type === 'FunctionDeclaration' && decl.id?.name === targetExport) {
            const loc = decl.loc?.start;
            if (loc && !foundLoc) foundLoc = { line: loc.line, column: loc.column };
          } else if (decl.type === 'VariableDeclaration') {
            for (const d of decl.declarations) {
              if (d.id?.name === targetExport) {
                const loc = d.loc?.start;
                if (loc && !foundLoc) foundLoc = { line: loc.line, column: loc.column };
              }
            }
          }
        }
        if (p.node.specifiers) {
          for (const s of p.node.specifiers) {
            const exportedName = s.exported?.name ?? s.exported?.value;
            if (exportedName === targetExport) {
              const loc = s.loc?.start;
              if (loc && !foundLoc) foundLoc = { line: loc.line, column: loc.column };
            }
          }
        }
      }
    });

    // If not in an export statement, check top-level function/variable declarations in that file
    if (!foundLoc) {
      traverse(ast, {
        FunctionDeclaration(p: any) {
          if (p.node.id?.name === targetExport) {
            const loc = p.node.loc?.start;
            if (loc && !foundLoc) foundLoc = { line: loc.line, column: loc.column };
          }
        },
        VariableDeclarator(p: any) {
          if (p.node.id?.name === targetExport) {
            const loc = p.node.loc?.start;
            if (loc && !foundLoc) foundLoc = { line: loc.line, column: loc.column };
          }
        }
      });
    }
  }

  return {
    line: (foundLoc as any)?.line ?? 1,
    column: (foundLoc as any)?.column ?? 0,
    exportType: resolvedExportType
  };
}

export function resolveComponentDefinition(
  options: ResolveComponentOptions
): ComponentDefinition | null {
  const { filepath, componentName } = options;
  if (!filepath || !componentName) return null;

  // Root name for member expressions (e.g. "Card" from "Card.Title")
  const rootName = componentName.split('.')[0].trim();
  if (!rootName) return null;

  const resolvedFilepath = path.resolve(filepath);
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : findProjectRoot(path.dirname(resolvedFilepath));

  let code = options.sourceCode;
  if (code === undefined) {
    try {
      code = fs.readFileSync(resolvedFilepath, 'utf-8');
    } catch {
      code = '';
    }
  }

  // 1. Try resolving local definitions in the current file
  if (code) {
    try {
      const ast = parseBabel(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      let localLoc: { line: number; column: number } | null = null;

      traverse(ast, {
        FunctionDeclaration(p: any) {
          if (p.node.id?.name === rootName) {
            const loc = p.node.loc?.start;
            if (loc && !localLoc) localLoc = { line: loc.line, column: loc.column };
          }
        },
        VariableDeclarator(p: any) {
          if (p.node.id?.name === rootName) {
            const loc = p.node.loc?.start;
            if (loc && !localLoc) localLoc = { line: loc.line, column: loc.column };
          }
        },
        ClassDeclaration(p: any) {
          if (p.node.id?.name === rootName) {
            const loc = p.node.loc?.start;
            if (loc && !localLoc) localLoc = { line: loc.line, column: loc.column };
          }
        }
      });

      if (localLoc) {
        return {
          componentName,
          file: resolvedFilepath,
          line: (localLoc as any).line,
          column: (localLoc as any).column,
          isLocal: true,
          exportType: 'local'
        };
      }

      // 2. Check ImportDeclarations in current file
      let matchedImport: {
        specifier: string;
        targetExport: string;
      } | null = null;

      traverse(ast, {
        ImportDeclaration(p: any) {
          const specifierSource = p.node.source.value;
          for (const s of p.node.specifiers) {
            if (s.local?.name === rootName) {
              if (s.type === 'ImportDefaultSpecifier') {
                matchedImport = { specifier: specifierSource, targetExport: 'default' };
              } else if (s.type === 'ImportSpecifier') {
                const importedName = s.imported?.name ?? s.imported?.value ?? s.local.name;
                matchedImport = { specifier: specifierSource, targetExport: importedName };
              } else if (s.type === 'ImportNamespaceSpecifier') {
                matchedImport = { specifier: specifierSource, targetExport: '*' };
              }
              break;
            }
          }
        }
      });

      if (matchedImport) {
        const importInfo = matchedImport as { specifier: string; targetExport: string };
        const targetPath = resolveImportPath(importInfo.specifier, resolvedFilepath, projectRoot);
        if (targetPath) {
          const coords = findExportCoordinatesInFile(targetPath, importInfo.targetExport);
          return {
            componentName,
            file: path.resolve(targetPath),
            line: coords.line,
            column: coords.column,
            isLocal: false,
            exportType: coords.exportType
          };
        }
      }
    } catch (e) {
      // AST parse error in current file — continue to fallback
    }
  }

  // 3. Fallback: Search glide-components.json in projectRoot
  try {
    const regPath = path.join(projectRoot, 'glide-components.json');
    if (fs.existsSync(regPath)) {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
      if (reg?.buckets && Array.isArray(reg.buckets)) {
        const bucket = reg.buckets.find(
          (b: any) => b.name && b.name.toLowerCase() === rootName.toLowerCase()
        );
        if (bucket && bucket.file && fs.existsSync(bucket.file)) {
          return {
            componentName,
            file: path.resolve(bucket.file),
            line: bucket.line || 1,
            column: bucket.column || 0,
            isLocal: path.resolve(bucket.file) === resolvedFilepath,
            exportType: bucket.exportType || 'named'
          };
        }
      }
    }
  } catch {}

  return null;
}
