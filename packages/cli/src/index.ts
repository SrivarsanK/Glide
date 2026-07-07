#!/usr/bin/env node
import { GlideServer, pushHistory } from '@srivarsank/server';
import { updateClassName, updateJSXText, updateClassString, updateJSXStyleProp } from '@srivarsank/ast-writer';
import { groupJSXElements, ungroupJSXElement } from '@srivarsank/ast-writer';
import { updateVueSFCClass } from '@srivarsank/adapter-vue';
import { updateSvelteClass } from '@srivarsank/adapter-svelte';
import { updateHTMLClass, updateHTMLText, getElementClass } from '@srivarsank/adapter-html';
import * as fs from 'fs';
import * as path from 'path';

const port = process.env.PORT ? parseInt(process.env.PORT) : 7777;
const targetPort = process.argv[2] ? parseInt(process.argv[2], 10) : 5173;
const server = new GlideServer(port, targetPort);

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

  const code = fs.readFileSync(file, 'utf-8');

  if (change.type === 'group') {
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
    // Write inline style prop directly to JSX — works with any CSS setup
    const updated = updateJSXStyleProp(code, line, column, change.value as Record<string, string>, hash);
    fs.writeFileSync(file, updated, 'utf-8');
    // Squash consecutive style edits on same element within 2s into one history entry
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
    if (file.endsWith('.html')) {
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
