/**
 * Link interactions: reads one from an element's rendered attributes and plans the single
 * source change that writes it. Self-contained, because the editor embeds it as source text.
 */
export function createInteractions() {
  type Info = { tag: string; href: string | null; target: string | null; rel: string | null };
  type Choice = { action: 'none' | 'page' | 'url' | 'scroll'; value: string; newTab?: boolean };

  /** The interaction an element has now; the source is its only record. */
  function read(info: Info | null): Choice {
    if (!info || info.tag !== 'a' || info.href === null) return { action: 'none', value: '' };
    if (info.href.startsWith('#')) return { action: 'scroll', value: info.href.slice(1) };
    if (/^[a-z][a-z0-9+.-]*:/i.test(info.href)) return { action: 'url', value: info.href, newTab: info.target === '_blank' };
    return { action: 'page', value: info.href };
  }

  /** What is wrong with a choice, or '' when it can be written. */
  function problem(choice: Choice, ids: string[]): string {
    const value = choice.value.trim();
    if (choice.action === 'page' && !value.startsWith('/')) return 'A page path starts with /, like /pricing.';
    if (choice.action === 'url' && !/^(https?:\/\/|mailto:|tel:)\S/i.test(value)) return 'Enter a web address (https://…), a mailto: or a tel: link.';
    if (choice.action === 'scroll' && !ids.includes(value)) return 'Choose an element on this page that has an id.';
    return '';
  }

  /** One `retag` change: the element becomes a link with these attributes, or stops being one. */
  function plan(choice: Choice, info: Info) {
    // Only the rel this panel writes for a new tab is removed; a rel written by hand stays.
    const ownRel = info.rel === 'noopener noreferrer';
    // A hand-written rel keeps the <a>; without href it is no longer a link, which read() already treats as none.
    const keepAnchor = info.tag === 'a' && !!info.rel && !ownRel;
    if (choice.action === 'none') return { type: 'retag', tagName: info.tag === 'a' && !keepAnchor ? 'div' : info.tag, attributes: { href: null, target: null, ...(ownRel ? { rel: null } : {}) } };
    const newTab = choice.action === 'url' && !!choice.newTab;
    const href = choice.action === 'scroll' ? '#' + choice.value.trim() : choice.value.trim();
    // A button's `type` means nothing on a link, and the retag refuses to leave it behind.
    return { type: 'retag', tagName: 'a', attributes: { href, target: newTab ? '_blank' : null,
      ...(!newTab && ownRel ? { rel: null } : {}), ...(info.tag === 'button' ? { type: null } : {}) } };
  }

  return { read, problem, plan };
}
