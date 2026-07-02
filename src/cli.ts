import { GlideServer } from './index.js';
import { updateClassName, updateJSXText, updateClassString, updateJSXStyleProp } from './writer.js';
import { updateVueSFCClass } from './vue.js';
import { updateSvelteClass } from './svelte.js';
import { updateHTMLClass, updateHTMLText, getElementClass } from './html.js';
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

server.onEdit((file, line, column, change) => {
  const targetId = `${file}:${line}:${column}`;

  if (change.type === 'position') {
    // ── ZERO-FLICKER POSITION STORAGE ────────────────────────────────────
    // Write position to glide-positions.json instead of modifying the JSX source.
    // This avoids triggering Vite HMR and prevents full page reloads (flicker).
    // The Glide Vite plugin reads this file and injects CSS position overrides.
    const positionsFile = getPositionsFile(file);
    let positions: Record<string, Record<string, string>> = {};
    if (fs.existsSync(positionsFile)) {
      try { positions = JSON.parse(fs.readFileSync(positionsFile, 'utf-8')); } catch {}
    }
    positions[targetId] = change.value as Record<string, string>;
    fs.writeFileSync(positionsFile, JSON.stringify(positions, null, 2), 'utf-8');
    console.log(`[Glide] Saved position for ${targetId} in ${positionsFile}`);
    return;
  }

  const code = fs.readFileSync(file, 'utf-8');

  if (change.type === 'multi-class') {
    let updated = code;
    const edits = change.value as Record<string, string>;
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
        updated = updateClassName(updated, line, column, property, value);
      }
    }
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated multi style class in ${file}:${line}:${column}`);
  } else if (change.type === 'style') {
    // Write inline style prop directly to JSX — works with any CSS setup
    const updated = updateJSXStyleProp(code, line, column, change.value as Record<string, string>);
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated inline style in ${file}:${line}:${column}`);
  } else if (change.type === 'class') {
    let updated = '';
    if (file.endsWith('.vue')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property, change.value);
      updated = updateVueSFCClass(code, targetId, newClasses);
    } else if (file.endsWith('.svelte')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property, change.value);
      updated = updateSvelteClass(code, targetId, newClasses);
    } else if (file.endsWith('.html')) {
      const existing = getElementClass(code, targetId);
      const newClasses = updateClassString(existing, change.property, change.value);
      updated = updateHTMLClass(code, targetId, newClasses);
    } else {
      updated = updateClassName(code, line, column, change.property, change.value);
    }
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated style class in ${file}:${line}:${column}`);
  } else if (change.type === 'text') {
    let updated = '';
    if (file.endsWith('.html')) {
      updated = updateHTMLText(code, targetId, change.value);
    } else {
      updated = updateJSXText(code, line, column, change.value);
    }
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated text content in ${file}:${line}:${column}`);
  }
});

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
}).catch((err) => {
  console.error(`[Glide] Server failed to start:`, err);
});
