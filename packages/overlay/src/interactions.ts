/**
 * Click interactions: reads one from an element's rendered attributes and plans the single
 * source change that writes it. Self-contained, because the editor embeds it as source text.
 */
export function createInteractions() {
  type Info = { tag: string; href: string | null; target: string | null; rel: string | null;
    type?: string | null; popoverTarget?: string | null; popoverAction?: string | null; inPopover?: string | null };
  type Action = 'none' | 'page' | 'url' | 'scroll' | 'open-overlay' | 'close-overlay';
  type Choice = { action: Action; value: string; newTab?: boolean };

  /** The interaction an element has now; the source is its only record. */
  function read(info: Info | null): Choice {
    if (info && info.tag === 'button' && info.popoverTarget) {
      return { action: info.popoverAction === 'hide' ? 'close-overlay' : 'open-overlay', value: info.popoverTarget };
    }
    if (!info || info.tag !== 'a' || info.href === null) return { action: 'none', value: '' };
    if (info.href.startsWith('#')) return { action: 'scroll', value: info.href.slice(1) };
    if (/^[a-z][a-z0-9+.-]*:/i.test(info.href)) return { action: 'url', value: info.href, newTab: info.target === '_blank' };
    return { action: 'page', value: info.href };
  }

  /** What is wrong with a choice, or '' when it can be written. */
  function problem(choice: Choice, ids: string[], overlays: string[] = [], info?: Info | null): string {
    const value = choice.value.trim();
    if (choice.action === 'page' && !value.startsWith('/')) return 'A page path starts with /, like /pricing.';
    if (choice.action === 'url' && !/^(https?:\/\/|mailto:|tel:)\S/i.test(value)) return 'Enter a web address (https://…), a mailto: or a tel: link.';
    if (choice.action === 'scroll' && !ids.includes(value)) return 'Choose an element on this page that has an id.';
    const overlay = choice.action === 'open-overlay' || choice.action === 'close-overlay';
    // A submit button would send its form instead of toggling the overlay.
    if (overlay && info && info.tag === 'button' && info.type && info.type !== 'button') return 'This button submits a form. Change its type to "button" first.';
    if (choice.action === 'open-overlay' && !overlays.includes(value)) {
      return 'Choose an overlay. To make one, give a frame an id and the popover attribute (Add attribute).';
    }
    if (choice.action === 'close-overlay' && !(info && info.inPopover)) return 'Close overlay works on a button inside an overlay that has an id.';
    return '';
  }

  /** One `retag` change: the element becomes a link or an overlay button, or stops being one. */
  function plan(choice: Choice, info: Info) {
    // Only the rel this panel writes for a new tab is removed; a rel written by hand stays.
    const ownRel = info.rel === 'noopener noreferrer';
    const noOverlay = { popoverTarget: null, popoverTargetAction: null };
    const noLink = { href: null, target: null, ...(ownRel ? { rel: null } : {}) };
    if (choice.action === 'none') return { type: 'retag', tagName: info.tag === 'a' ? 'div' : info.tag, attributes: { ...noLink, ...noOverlay } };
    if (choice.action === 'open-overlay' || choice.action === 'close-overlay') {
      const target = choice.action === 'close-overlay' ? info.inPopover : choice.value.trim();
      return { type: 'retag', tagName: 'button', attributes: { ...noLink, type: 'button', popoverTarget: target,
        popoverTargetAction: choice.action === 'close-overlay' ? 'hide' : null } };
    }
    const newTab = choice.action === 'url' && !!choice.newTab;
    const href = choice.action === 'scroll' ? '#' + choice.value.trim() : choice.value.trim();
    // A button's `type` means nothing on a link, and the retag refuses to leave it behind.
    return { type: 'retag', tagName: 'a', attributes: { href, target: newTab ? '_blank' : null, ...noOverlay,
      ...(!newTab && ownRel ? { rel: null } : {}), ...(info.tag === 'button' ? { type: null } : {}) } };
  }

  return { read, problem, plan };
}
