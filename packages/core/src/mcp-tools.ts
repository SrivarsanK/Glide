/** The tools Glide's MCP server offers. Shared so `glide mcp` can list them while Glide is not running. */
const source = { type: 'string', description: 'An element reference: file:line:column (from get_selection, get_tree or data-gl-source).' };
const expectedDigest = { type: 'string', description: 'The file digest from get_source. When the file changed since, the edit is refused (STALE_DIGEST).' };

// What the attribute writer accepts: text, true for a bare attribute, or null to remove it (never false).
const attributeValue = { anyOf: [{ type: 'string' }, { const: true }, { type: 'null' }] };

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
  { name: 'set_attribute', description: 'Add, change or remove an attribute on an HTML element: href, target, rel, id, type, title, alt, src, name, placeholder, disabled, popover, popoverTarget, popoverTargetAction, role or aria-*. A value of null removes it; true writes it without a value.',
    inputSchema: { type: 'object', properties: { source, name: { type: 'string' }, value: attributeValue, expectedDigest }, required: ['source', 'name', 'value'] },
    annotations: { destructiveHint: false } },
  { name: 'retag', description: 'Change what an HTML element is (div, section, header, nav, a, button, h1-h6, p, li, ...), optionally setting attributes in the same edit: a link is retag to "a" with {href}; an overlay trigger is retag to "button" with {popoverTarget}. Refuses invalid HTML.',
    inputSchema: { type: 'object', properties: { source, tag: { type: 'string' }, attributes: { type: 'object', additionalProperties: attributeValue }, expectedDigest }, required: ['source', 'tag'] },
    annotations: { destructiveHint: false } },
  { name: 'duplicate_element', description: 'Duplicate one element right after itself.',
    inputSchema: { type: 'object', properties: { source, expectedDigest }, required: ['source'] }, annotations: { destructiveHint: false } },
  { name: 'move_element', description: 'Move one element into a parent in the same file, before or after a sibling there (or last).',
    inputSchema: { type: 'object', properties: { source, parent: source, sibling: source, position: { type: 'string', enum: ['before', 'after'] }, expectedDigest },
      required: ['source', 'parent'] }, annotations: { destructiveHint: false } },
  { name: 'extract_component', description: 'Move one element into a new component function above the current one, in the same file, and use it in its place. The markup may not use variables of the component around it.',
    inputSchema: { type: 'object', properties: { source, name: { type: 'string', description: 'PascalCase, like PricingCard.' }, expectedDigest }, required: ['source', 'name'] },
    annotations: { destructiveHint: false } },
  { name: 'get_guide', description: 'How to work in a Glide project: conventions that keep the canvas able to edit what you write. Read it once per session.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
];

/** Conventions for agents, served by get_guide. */
export const MCP_GUIDE = [
  'Glide edits the running app; the source file is the only record. What the canvas can edit, it reads back from plain literals.',
  '- Keep className, style, href, id and text as literal values. A computed class or style makes that element read-only on the canvas.',
  '- Tailwind projects: change one property class at a time and keep variants such as md: and hover:, which are separate decisions. Prefer theme tokens over arbitrary values.',
  '- Lay out with flex and gap rather than absolute positions; frames drawn on the canvas start as flex columns.',
  '- Interactions are plain HTML: links are <a href="/page">, new tabs add target="_blank" rel="noopener noreferrer", scroll targets are href="#id", overlays are <button type="button" popoverTarget="id"> with an element that has id and popover.',
  '- States are hover:, active: and focus-visible: classes; animations are transition, duration-* and ease-* classes on the normal look.',
  '- Elements in {false && …} with data-gl-workspace-* attributes are drafts on the pasteboard; leave them.',
  '- After STALE_DIGEST, the user changed the file: read it again with get_source before the next edit.',
].join('\n');

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
