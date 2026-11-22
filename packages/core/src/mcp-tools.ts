/** The tools Glide's MCP server offers. Shared so `glide mcp` can list them while Glide is not running. */
const source = { type: 'string', description: 'An element reference: file:line:column (from get_selection, get_tree or data-gl-source).' };
const expectedDigest = { type: 'string', description: 'The file digest from get_source. When the file changed since, the edit is refused (STALE_DIGEST).' };

export const MCP_TOOLS = [
  { name: 'get_project_info', description: 'Framework, Tailwind version, entry file and routes of the project Glide is editing. Call this first.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'get_selection', description: 'The elements the user selected on the Glide canvas, with their source references and computed styles. Needs the Glide editor open.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'get_tree', description: 'The element tree of one source file, each element with its source reference.',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Path of the source file, relative to the project root.' } }, required: ['file'] },
    annotations: { readOnlyHint: true } },
  { name: 'get_source', description: 'The exact source of one element, and the file digest to pass to edit tools. In Vue, Svelte, Astro and HTML files the code is an excerpt: up to 20 lines from the element, with `excerpt` giving the line range.',
    inputSchema: { type: 'object', properties: { source }, required: ['source'] }, annotations: { readOnlyHint: true } },
  { name: 'update_styles', description: 'Change CSS properties of one element through Glide, written as Tailwind classes or inline styles like the project uses. Keeps responsive and state variants. Properties use camelCase CSS names (backgroundColor, paddingTop); an empty value removes one.',
    inputSchema: { type: 'object', properties: { source, styles: { type: 'object', additionalProperties: { type: 'string' } },
      breakpoint: { type: 'string', description: 'Tailwind breakpoint such as md, or omit for the base style.' },
      state: { type: 'string', description: 'hover, focus, focus-visible, active or disabled; omit for the normal look.' }, expectedDigest },
    required: ['source', 'styles'] }, annotations: { destructiveHint: false } },
  { name: 'set_text', description: 'Replace the literal text of one element.',
    inputSchema: { type: 'object', properties: { source, text: { type: 'string' }, expectedDigest }, required: ['source', 'text'] },
    annotations: { destructiveHint: false } },
  { name: 'delete_element', description: 'Delete one element and its children from the source.',
    inputSchema: { type: 'object', properties: { source, expectedDigest }, required: ['source'] }, annotations: { destructiveHint: true } },
];

export const MCP_INSTRUCTIONS = 'Glide is a visual editor whose canvas is the running app and whose only record is the source code. '
  + 'Use get_selection to see what the user is pointing at, get_source before editing, and the edit tools for style, text and '
  + 'delete changes so they keep the project conventions and join the user\'s undo history. Refused edits explain why; '
  + 'after STALE_DIGEST, read the element again. For anything else (logic, new components), edit the files directly '
  + 'and keep class names and attributes as plain literals so the canvas can still edit them.';

export const MCP_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

/** The answer `glide mcp` gives while Glide is not running: enough for an agent to connect and see the tools. */
export function offlineMcpReply(message: any, version: string, project: string): unknown {
  if (!message || message.id === undefined || message.id === null) return null;
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result });
  switch (message.method) {
    case 'initialize': {
      const asked = message.params?.protocolVersion;
      return reply({ protocolVersion: MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOLS[0], capabilities: { tools: {} },
        serverInfo: { name: 'glide', version }, instructions: MCP_INSTRUCTIONS });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: MCP_TOOLS });
    case 'tools/call': return reply({ isError: true, content: [{ type: 'text',
      text: `Glide is not running for ${project}. Start the dev server with the Glide plugin (or \`npx @srivarsank/glide\`) and try again.` }] });
    default: return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } };
  }
}
