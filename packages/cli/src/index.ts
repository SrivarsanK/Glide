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

server.onEdit((file: string, line: number, column: number, change: any, hash?: string) => {
  const targetId = `${file}:${line}:${column}`;

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

  if (change.type === 'position') {
    // ── ZERO-FLICKER POSITION STORAGE ────────────────────────────────────
    // Write position to glide-positions.json instead of modifying the JSX source.
    // This avoids triggering Vite HMR and prevents full page reloads (flicker).
    // The Glide Vite plugin reads this file and injects CSS position overrides.
    const positionsFile = getPositionsFile(file);
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
    
    pushHistory({
      description: `Moved element in ${path.basename(file)}`,
      diffs: [{ file: positionsFile, before: beforeContent, after: afterContent }]
    });

    console.log(`[Glide] Saved position for ${targetId} in ${positionsFile}`);
    return;
  }

  if (change.type === 'bake-position') {
    const positionsFile = getPositionsFile(file);
    if (fs.existsSync(positionsFile)) {
      const posContent = fs.readFileSync(positionsFile, 'utf-8');
      try {
        const positions = JSON.parse(posContent);
        const posStyle = positions[targetId];
        if (posStyle) {
          const code = fs.readFileSync(file, 'utf-8');
          let updated = '';
          if (file.endsWith('.vue')) {
            updated = updateVueSFCStyle(code, targetId, posStyle);
          } else if (file.endsWith('.svelte')) {
            updated = updateSvelteStyle(code, targetId, posStyle);
          } else if (file.endsWith('.astro')) {
            updated = updateAstroStyle(code, targetId, posStyle);
          } else if (file.endsWith('.html')) {
            updated = updateHTMLStyle(code, targetId, posStyle);
          } else {
            updated = updateJSXStyleProp(code, line, column, posStyle, hash);
          }
          fs.writeFileSync(file, updated, 'utf-8');

          delete positions[targetId];
          const newPosContent = JSON.stringify(positions, null, 2);
          fs.writeFileSync(positionsFile, newPosContent, 'utf-8');

          pushHistory({
            description: `Baked position into source in ${path.basename(file)}`,
            diffs: [
              { file: path.resolve(file), before: code, after: updated },
              { file: positionsFile, before: posContent, after: newPosContent }
            ]
          });
          console.log(`[Glide] Baked position for ${targetId} into ${file}`);
        }
      } catch (e) {
        console.error(`[Glide] Failed to bake position:`, e);
      }
    }
    return;
  }

  const code = fs.readFileSync(file, 'utf-8');

  if (change.type === 'group') {
    if (file.endsWith('.vue') || file.endsWith('.svelte') || file.endsWith('.astro') || file.endsWith('.html')) {
      console.warn(`[Glide] Grouping is currently supported for JSX files only (${path.basename(file)})`);
      return;
    }
    const updated = groupJSXElements(code, change.sources!);
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: `Grouped elements in ${path.basename(file)}`,
      diffs: [{ file: path.resolve(file), before: code, after: updated }]
    });
    console.log(`[Glide] Grouped elements in ${file}`);
    return;
  }

  if (change.type === 'ungroup') {
    if (file.endsWith('.vue') || file.endsWith('.svelte') || file.endsWith('.astro') || file.endsWith('.html')) {
      console.warn(`[Glide] Ungrouping is currently supported for JSX files only (${path.basename(file)})`);
      return;
    }
    const updated = ungroupJSXElement(code, change.source!);
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: `Ungrouped element in ${path.basename(file)}`,
      diffs: [{ file: path.resolve(file), before: code, after: updated }]
    });
    console.log(`[Glide] Ungrouped element ${change.source!} in ${file}`);
    return;
  }

  if (change.type === 'multi-class') {
    let updated = code;
    const edits = change.value as Record<string, string>;
    let currentHash = hash;
    for (const [property, value] of Object.entries(edits)) {
      if (file.endsWith('.vue')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateVueSFCClass(updated, targetId, newClasses);
      } else if (file.endsWith('.svelte')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateSvelteClass(updated, targetId, newClasses);
      } else if (file.endsWith('.astro')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateAstroClass(updated, targetId, newClasses);
      } else if (file.endsWith('.html')) {
        const existing = getElementClass(updated, targetId);
        const newClasses = updateClassString(existing, property, value);
        updated = updateHTMLClass(updated, targetId, newClasses);
      } else {
        updated = updateClassName(updated, line, column, property, value, undefined, currentHash);
        currentHash = undefined;
      }
    }
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: `Updated multiple styles in ${path.basename(file)}`,
      diffs: [{ file: path.resolve(file), before: code, after: updated }]
    });
    console.log(`[Glide] Updated multi style class in ${file}:${line}:${column}`);
  } else if (change.type === 'style') {
    let updated = '';
    const styles = change.value as Record<string, string>;
    if (file.endsWith('.vue')) {
      updated = updateVueSFCStyle(code, targetId, styles);
    } else if (file.endsWith('.svelte')) {
      updated = updateSvelteStyle(code, targetId, styles);
    } else if (file.endsWith('.astro')) {
      updated = updateAstroStyle(code, targetId, styles);
    } else if (file.endsWith('.html')) {
      updated = updateHTMLStyle(code, targetId, styles);
    } else {
      updated = updateJSXStyleProp(code, line, column, styles, hash);
    }
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: buildDescription(change, file, line),
      diffs: [{ file: path.resolve(file), before: code, after: updated }],
      squashKey: `style:${path.resolve(file)}:${line}:${column}`,
      squashWindowMs: 2000
    });
    console.log(`[Glide] Updated inline style in ${file}:${line}:${column}`);
  } else if (change.type === 'class') {
    let updated = '';
    if (file.endsWith('.vue')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property!, change.value);
      updated = updateVueSFCClass(code, targetId, newClasses);
    } else if (file.endsWith('.svelte')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property!, change.value);
      updated = updateSvelteClass(code, targetId, newClasses);
    } else if (file.endsWith('.astro')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property!, change.value);
      updated = updateAstroClass(code, targetId, newClasses);
    } else if (file.endsWith('.html')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property!, change.value);
      updated = updateHTMLClass(code, targetId, newClasses);
    } else {
      updated = updateClassName(code, line, column, change.property!, change.value, undefined, hash);
    }
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: buildDescription(change, file, line),
      diffs: [{ file: path.resolve(file), before: code, after: updated }]
    });
    console.log(`[Glide] Updated style class in ${file}:${line}:${column}`);
  } else if (change.type === 'text') {
    let updated = '';
    if (file.endsWith('.vue')) {
      updated = updateVueSFCText(code, targetId, change.value);
    } else if (file.endsWith('.svelte')) {
      updated = updateSvelteText(code, targetId, change.value);
    } else if (file.endsWith('.astro')) {
      updated = updateAstroText(code, targetId, change.value);
    } else if (file.endsWith('.html')) {
      updated = updateHTMLText(code, targetId, change.value);
    } else {
      updated = updateJSXText(code, line, column, change.value, hash);
    }
    fs.writeFileSync(file, updated, 'utf-8');
    pushHistory({
      description: buildDescription(change, file, line),
      diffs: [{ file: path.resolve(file), before: code, after: updated }]
    });
    console.log(`[Glide] Updated text content in ${file}:${line}:${column}`);
  }
});

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
}).catch((err: any) => {
  console.error(`[Glide] Server failed to start:`, err);
});
