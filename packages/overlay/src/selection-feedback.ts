/** Kept self-contained so tests exercise the exact function served to the browser. */
export function createSelectionFeedback(banner: HTMLElement, panel: HTMLElement) {
  return (selected: boolean, mapped: boolean) => {
    const blocked = selected && !mapped;
    banner.hidden = !blocked;
    banner.textContent = blocked
      ? 'This element has no editable source mapping. Select an authored element, or enable the Glide source-stamping plugin.'
      : '';
    panel.inert = blocked;
    panel.setAttribute('aria-disabled', String(blocked));
  };
}
