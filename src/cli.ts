import { GlideServer } from './index.js';
import { updateClassName, updateJSXText, updateClassString, updateJSXStyleProp } from './writer.js';
import { updateVueSFCClass } from './vue.js';
import { updateSvelteClass } from './svelte.js';
import { updateHTMLClass, updateHTMLText, getElementClass } from './html.js';
import * as fs from 'fs';

const port = process.env.PORT ? parseInt(process.env.PORT) : 7777;
const targetPort = process.argv[2] ? parseInt(process.argv[2], 10) : 5173;
const server = new GlideServer(port, targetPort);

server.onEdit((file, line, column, change) => {
  const targetId = `${file}:${line}:${column}`;
  const code = fs.readFileSync(file, 'utf-8');

  if (change.type === 'style') {
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
