/** Self-contained typed inspector embedded into the served editor. */
export function createSourceProps(options: {
  container: HTMLElement; send(message: any): void; selected(): string | null;
  parse(source: string): any; digest(file: string): string | undefined;
  edit(source: string, change: any, digest: string): void;
}) {
  let requestId = 0;
  let requestedSource: string | null = null;
  function request() {
    const source = options.selected();
    const parsed = source && options.parse(source);
    requestedSource = source;
    options.container.replaceChildren();
    if (!parsed) { options.container.textContent = 'No verified source mapping. Select an authored layer to edit.'; return; }
    options.container.textContent = 'Reading authored props…';
    options.send({ type: 'inspect-props', ...parsed, expectedDigest: options.digest(parsed.file), requestId: ++requestId });
  }
  function accept(message: any) {
    if (message.type !== 'source-props' || message.requestId !== requestId || requestedSource !== options.selected()) return;
    const container = options.container;
    container.replaceChildren();
    if (!message.success) { container.textContent = message.error; return; }
    const caption = document.createElement('p');
    caption.textContent = message.scope === 'call-site'
      ? 'Call-site props · affects every runtime instance of this authored call site.'
      : 'Source element · edits may affect every render of its containing definition.';
    container.append(caption);
    if (message.spread) {
      const note = document.createElement('p'); note.textContent = 'Spread values are read-only.'; container.append(note);
    }
    for (const prop of message.props) {
      const label = document.createElement('label'); label.className = 'props-row';
      const name = document.createElement('span'); name.textContent = prop.name; name.className = 'props-label'; label.append(name);
      const input = document.createElement(prop.kind === 'enum' ? 'select' : 'input') as HTMLInputElement | HTMLSelectElement;
      input.className = 'props-input'; input.setAttribute('aria-label', prop.name);
      if (prop.kind === 'enum') {
        for (const value of prop.choices) {
          const option = document.createElement('option'); option.value = JSON.stringify(value); option.textContent = String(value); input.append(option);
        }
        input.value = JSON.stringify(prop.value);
      } else {
        const field = input as HTMLInputElement;
        field.type = prop.kind === 'boolean' ? 'checkbox' : prop.kind === 'number' ? 'number' : 'text';
        if (field.type === 'number') field.step = 'any';
        field.checked = prop.value === true; field.value = prop.value === undefined ? '' : String(prop.value);
      }
      input.disabled = !!prop.reason;
      if (prop.reason) { input.title = prop.reason; const reason = document.createElement('small'); reason.textContent = prop.reason; label.append(reason); }
      input.addEventListener('change', () => {
        if (options.selected() !== requestedSource || !requestedSource) return;
        const value = prop.kind === 'enum' ? JSON.parse(input.value) : prop.kind === 'boolean' ? (input as HTMLInputElement).checked
          : prop.kind === 'number' ? Number(input.value) : input.value;
        if (prop.kind === 'number' && (!input.value.trim() || !Number.isFinite(value))) return;
        options.edit(requestedSource, { type: 'prop', property: prop.name, value, scope: message.scope }, message.digest);
      });
      label.append(input); container.append(label);
    }
    if (!message.props.length) { const note = document.createElement('p'); note.textContent = 'No literal props are authored here.'; container.append(note); }
  }
  return { request, accept };
}
