#!/usr/bin/env node
import { GlideServer } from './index.js';
import { updateClassName, updateJSXText } from './writer.js';
import * as fs from 'fs';

const port = process.env.PORT ? parseInt(process.env.PORT) : 7777;
const server = new GlideServer(port);

server.onEdit((file, line, column, change) => {
  if (change.type === 'class') {
    const code = fs.readFileSync(file, 'utf-8');
    const updated = updateClassName(code, line, column, change.property, change.value);
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated style class in ${file}:${line}:${column}`);
  } else if (change.type === 'text') {
    const code = fs.readFileSync(file, 'utf-8');
    const updated = updateJSXText(code, line, column, change.value);
    fs.writeFileSync(file, updated, 'utf-8');
    console.log(`[Glide] Updated text content in ${file}:${line}:${column}`);
  }
});

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
}).catch((err) => {
  console.error(`[Glide] Server failed to start:`, err);
});
