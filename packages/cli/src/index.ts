#!/usr/bin/env node
import { GlideServer, pushHistory } from '@srivarsank/server';
import { updateClassName, updateJSXText, updateClassString, updateJSXStyleProp } from '@srivarsank/ast-writer';
import { groupJSXElements, ungroupJSXElement } from '@srivarsank/ast-writer';
import { updateVueSFCClass, updateVueSFCStyle, updateVueSFCText } from '@srivarsank/adapter-vue';
import { updateSvelteClass, updateSvelteStyle, updateSvelteText } from '@srivarsank/adapter-svelte';
import { updateAstroClass, updateAstroStyle, updateAstroText } from '@srivarsank/adapter-astro';
import { updateHTMLClass, updateHTMLStyle, updateHTMLText, getElementClass } from '@srivarsank/adapter-html';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfigFromDisk, buildRegistry, watchRegistry } from '@srivarsank/core';

const config = await loadConfigFromDisk(process.cwd());

// Precedence: CLI arg (numeric only) > env var > config file > default (5173)
// Note: argv[2] is often "dev" (subcommand) — ignore non-numeric values
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;
const _argvPort = process.argv[2] && /^\d+$/.test(process.argv[2]) ? parseInt(process.argv[2], 10) : NaN;
const targetPort = !isNaN(_argvPort) ? _argvPort : config.targetPort;

// Keep the object and the args in sync so GlideServer and getEditorHTML(config) see the real target
config.port = port;
config.targetPort = targetPort;

const server = new GlideServer(port, targetPort, config);

// ── Component Registry ────────────────────────────────────────────────────────

const registryFile = path.join(process.cwd(), 'glide-components.json');

function writeRegistryToDisk(): void {
  try {
    const registry = buildRegistry({ projectRoot: process.cwd() });
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[Glide] Component registry → ${path.basename(registryFile)} (${registry.buckets.length} buckets)`);
  } catch (e) {
    console.warn('[Glide] Registry build failed:', e);
  }
}

// Initial write on startup
writeRegistryToDisk();

// Watch for source file changes and rebuild incrementally
watchRegistry(process.cwd(), (registry) => {
  try {
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[Glide] Registry updated → ${registry.buckets.length} buckets`);
  } catch (e) {
    console.warn('[Glide] Registry write failed:', e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the glide-positions.json file for a given source file.
 * Walks up the directory tree looking for the project root (package.json).
 */
function getPositionsFile(file: string): string {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, 'glide-positions.json');
    }
    dir = path.dirname(dir);
  }
  return path.join(path.dirname(file), 'glide-positions.json');
}

function resolveFilePath(file: string): string {
  if (!file) return file;
  if (path.isAbsolute(file) && fs.existsSync(file)) return file;

  const candidates = [
    file,
    path.resolve(process.cwd(), file),
    path.resolve(process.cwd(), '..', file)
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }

  return path.resolve(process.cwd(), file);
}

server.onEdit((file: string, line: number, column: number, change: any, hash?: string) => {
  const targetId = `${file}:${line}:${column}`;
  const realFile = resolveFilePath(file);

  function buildDescription(change: any, file: string, line?: number): string {
    const shortFile = path.basename(file);
    const locSuffix = line ? `:${line}` : '';
    if (change.type === 'style' && typeof change.value === 'object') {
      // Format: "backgroundColor: #ff0000 on App.tsx:68"
      const entries = Object.entries(change.value as Record<string, string>);
      if (entries.length === 1) {
        const [prop, val] = entries[0];
        return `${prop}: ${val} on ${shortFile}${locSuffix}`;
      }
      const props = entries.map(([p]) => p).join(', ');
      return `${props} on ${shortFile}${locSuffix}`;
    }
    const prop = change.property || change.type || 'style';
    const val = typeof change.value === 'object' ? JSON.stringify(change.value) : change.value;
    return `${prop}: ${val} on ${shortFile}${locSuffix}`;
  }

  function pushEditHistory(entry: {
    description: string;
    diffs: Array<{ file: string; before: string; after: string }>;
    squashKey?: string;
    squashWindowMs?: number;
  }) {
    if (change && change.batchSquashKey) {
      pushHistory({
        description: change.batchDescription || entry.description,
        diffs: entry.diffs,
        squashKey: change.batchSquashKey,
        squashWindowMs: 60000,
      });
    } else {
      pushHistory(entry);
    }
  }

  if (change.type === 'position') {
    // ── ZERO-FLICKER POSITION STORAGE ────────────────────────────────────
    // Write position to glide-positions.json instead of modifying the JSX source.
    // This avoids triggering Vite HMR and prevents full page reloads (flicker).
    // The Glide Vite plugin reads this file and injects CSS position overrides.
    const positionsFile = getPositionsFile(realFile);
    let beforeContent = '';
    if (fs.existsSync(positionsFile)) {
      beforeContent = fs.readFileSync(positionsFile, 'utf-8');
    }

    let positions: Record<string, Record<string, string>> = {};
    if (beforeContent) {
      try { positions = JSON.parse(beforeContent); } catch {}
    }
    positions[targetId] = change.value as Record<string, string>;
    const afterContent = JSON.stringify(positions, null, 2);
    fs.writeFileSync(positionsFile, afterContent, 'utf-8');
    server.recordSelfWrite(positionsFile);
    
    pushHistory({
      description: `Moved element in ${path.basename(realFile)}`,
      diffs: [{ file: positionsFile, before: beforeContent, after: afterContent }]
    });

    console.log(`[Glide] Saved position for ${targetId} in ${positionsFile}`);
    return;
  }

  if (change.type === 'bake-position') {
    const positionsFile = getPositionsFile(realFile);
    if (fs.existsSync(positionsFile)) {
      try {
        const posContent = fs.readFileSync(positionsFile, 'utf-8');
        const positions = JSON.parse(posContent);
        const savedPos = positions[targetId];
        if (savedPos && fs.existsSync(realFile)) {
          const code = fs.readFileSync(realFile, 'utf-8');
          let updated = '';
          if (realFile.endsWith('.vue')) {
            updated = updateVueSFCStyle(code, targetId, savedPos);
          } else if (realFile.endsWith('.svelte')) {
            updated = updateSvelteStyle(code, targetId, savedPos);
          } else if (realFile.endsWith('.astro')) {
            updated = updateAstroStyle(code, targetId, savedPos);
          } else if (realFile.endsWith('.html')) {
            updated = updateHTMLStyle(code, targetId, savedPos);
          } else {
            updated = updateJSXStyleProp(code, line, column, savedPos, hash);
          }
          fs.writeFileSync(realFile, updated, 'utf-8');
          server.recordSelfWrite(realFile);

          delete positions[targetId];
          const newPosContent = JSON.stringify(positions, null, 2);
          fs.writeFileSync(positionsFile, newPosContent, 'utf-8');
          server.recordSelfWrite(positionsFile);

          pushHistory({
            description: `Baked position into ${path.basename(realFile)}`,
            diffs: [
              { file: path.resolve(realFile), before: code, after: updated },
              { file: positionsFile, before: posContent, after: newPosContent }
            ]
          });
          console.log(`[Glide] Baked position for ${targetId} into ${realFile}`);
        }
      } catch (e) {
        console.error(`[Glide] Failed to bake position:`, e);
      }
    }
    return;
  }

  const code = fs.readFileSync(realFile, 'utf-8');

  if (change.type === 'group') {
    if (realFile.endsWith('.vue') || realFile.endsWith('.svelte') || realFile.endsWith('.astro') || realFile.endsWith('.html')) {
      console.warn(`[Glide] Grouping is currently supported for JSX files only (${path.basename(realFile)})`);
      return;
    }
    const updated = groupJSXElements(code, change.sources!);
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushHistory({
      description: `Grouped elements in ${path.basename(realFile)}`,
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }]
    });
    console.log(`[Glide] Grouped elements in ${realFile}`);
    return;
  }

  if (change.type === 'ungroup') {
    if (realFile.endsWith('.vue') || realFile.endsWith('.svelte') || realFile.endsWith('.astro') || realFile.endsWith('.html')) {
      console.warn(`[Glide] Ungrouping is currently supported for JSX files only (${path.basename(realFile)})`);
      return;
    }
    const updated = ungroupJSXElement(code, change.source!);
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushHistory({
      description: `Ungrouped element in ${path.basename(realFile)}`,
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }]
    });
    console.log(`[Glide] Ungrouped element ${change.source!} in ${realFile}`);
    return;
  }

  if (change.type === 'multi-class') {
    let updated = code;
    const edits = change.value as Record<string, string>;
    let currentHash = hash;
    for (const [property, value] of Object.entries(edits)) {
      if (realFile.endsWith('.vue')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateVueSFCClass(updated, targetId, newClasses);
      } else if (realFile.endsWith('.svelte')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateSvelteClass(updated, targetId, newClasses);
      } else if (realFile.endsWith('.astro')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateAstroClass(updated, targetId, newClasses);
      } else if (realFile.endsWith('.html')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateHTMLClass(updated, targetId, newClasses);
      } else {
        updated = updateClassName(updated, line, column, property, value, undefined, currentHash);
        currentHash = undefined;
      }
    }
    if (updated === code) {
      console.warn(`[Glide] No-op edit: adapter returned unchanged code for ${realFile}:${line}:${column}`);
      throw new Error(`NO_CHANGE: Could not locate target element at ${path.basename(realFile)}:${line}:${column}`);
    }
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushEditHistory({
      description: `Updated multiple styles in ${path.basename(realFile)}`,
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }]
    });
    console.log(`[Glide] Updated multi style class in ${realFile}:${line}:${column}`);
  } else if (change.type === 'style') {
    let updated = '';
    const styles = change.value as Record<string, string>;
    if (realFile.endsWith('.vue')) {
      updated = updateVueSFCStyle(code, targetId, styles);
    } else if (realFile.endsWith('.svelte')) {
      updated = updateSvelteStyle(code, targetId, styles);
    } else if (realFile.endsWith('.astro')) {
      updated = updateAstroStyle(code, targetId, styles);
    } else if (realFile.endsWith('.html')) {
      updated = updateHTMLStyle(code, targetId, styles);
    } else {
      updated = updateJSXStyleProp(code, line, column, styles, hash);
    }
    if (updated === code) {
      console.warn(`[Glide] No-op edit: adapter returned unchanged code for ${realFile}:${line}:${column}`);
      throw new Error(`NO_CHANGE: Could not locate target element at ${path.basename(realFile)}:${line}:${column}`);
    }
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushEditHistory({
      description: buildDescription(change, realFile, line),
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }],
      squashKey: `style:${path.resolve(realFile)}:${line}:${column}`,
      squashWindowMs: 2000
    });
    console.log(`[Glide] Updated inline style in ${realFile}:${line}:${column}`);
  } else if (change.type === 'class') {
    let updated = '';
    const styleProps = [
      'width', 'height', 'fontSize', 'color', 'backgroundColor', 'backgroundImage',
      'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
      'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
      'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'rowGap',
      'opacity', 'borderWidth', 'borderStyle', 'borderRadius',
      'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
      'transform', 'position', 'left', 'top', 'right', 'bottom', 'zIndex', 'lineHeight', 'letterSpacing', 'fontFamily', 'fontWeight'
    ];
    if (change.property && styleProps.includes(change.property)) {
      const styles = { [change.property]: change.value };
      if (realFile.endsWith('.vue')) {
        updated = updateVueSFCStyle(code, targetId, styles);
      } else if (realFile.endsWith('.svelte')) {
        updated = updateSvelteStyle(code, targetId, styles);
      } else if (realFile.endsWith('.astro')) {
        updated = updateAstroStyle(code, targetId, styles);
      } else if (realFile.endsWith('.html')) {
        updated = updateHTMLStyle(code, targetId, styles);
      } else {
        updated = updateJSXStyleProp(code, line, column, styles, hash);
      }
    } else {
      if (realFile.endsWith('.vue')) {
        const existing = getElementClass(code, targetId);
        const newClasses = updateClassString(existing, change.property!, change.value);
        updated = updateVueSFCClass(code, targetId, newClasses);
      } else if (realFile.endsWith('.svelte')) {
        const existing = getElementClass(code, targetId);
        const newClasses = updateClassString(existing, change.property!, change.value);
        updated = updateSvelteClass(code, targetId, newClasses);
      } else if (realFile.endsWith('.astro')) {
        const existing = getElementClass(code, targetId);
        const newClasses = updateClassString(existing, change.property!, change.value);
        updated = updateAstroClass(code, targetId, newClasses);
      } else if (realFile.endsWith('.html')) {
        const existing = getElementClass(code, targetId);
        const newClasses = updateClassString(existing, change.property!, change.value);
        updated = updateHTMLClass(code, targetId, newClasses);
      } else {
        updated = updateClassName(code, line, column, change.property!, change.value, undefined, hash);
      }
    }
    if (updated === code) {
      console.warn(`[Glide] No-op edit: adapter returned unchanged code for ${realFile}:${line}:${column}`);
      throw new Error(`NO_CHANGE: Could not locate target element at ${path.basename(realFile)}:${line}:${column}`);
    }
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushEditHistory({
      description: buildDescription(change, realFile, line),
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }]
    });
    console.log(`[Glide] Updated style class in ${realFile}:${line}:${column}`);
  } else if (change.type === 'text') {
    let updated = '';
    if (realFile.endsWith('.vue')) {
      updated = updateVueSFCText(code, targetId, change.value);
    } else if (realFile.endsWith('.svelte')) {
      updated = updateSvelteText(code, targetId, change.value);
    } else if (realFile.endsWith('.astro')) {
      updated = updateAstroText(code, targetId, change.value);
    } else if (realFile.endsWith('.html')) {
      updated = updateHTMLText(code, targetId, change.value);
    } else {
      updated = updateJSXText(code, line, column, change.value, hash);
    }
    if (updated === code) {
      console.warn(`[Glide] No-op edit: adapter returned unchanged code for ${realFile}:${line}:${column}`);
      throw new Error(`NO_CHANGE: Could not locate target element at ${path.basename(realFile)}:${line}:${column}`);
    }
    fs.writeFileSync(realFile, updated, 'utf-8');
    server.recordSelfWrite(realFile);
    pushEditHistory({
      description: buildDescription(change, realFile, line),
      diffs: [{ file: path.resolve(realFile), before: code, after: updated }]
    });
    console.log(`[Glide] Updated text content in ${realFile}:${line}:${column}`);
  }
});

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
}).catch((err: any) => {
  console.error(`[Glide] Server failed to start:`, err);
});
