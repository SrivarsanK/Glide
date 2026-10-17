import type { MutationScope } from '@srivarsank/core';

/** Shared by live edits and staging; capture scope when the user makes the edit. */
export function createMutationScope(read: () => MutationScope) {
  function capture(change: any) {
    if (!['class', 'multi-class', 'style', 'position', 'layout'].includes(change?.type)) return change;
    return { ...read(), ...change };
  }
  function key(change: any, property: string) {
    return JSON.stringify([change.breakpoint || '', change.pseudoState || '', change.authoringRepresentation || '', property]);
  }
  function entries(change: any): { key: string; change: any }[] {
    change = capture(change);
    if (['multi-class', 'style', 'layout'].includes(change.type) && change.value && typeof change.value === 'object') {
      return Object.entries(change.value).map(([property, value]) => ({
        key: key(change, property),
        change: change.type === 'multi-class'
          ? { ...change, type: 'class', property, value }
          : { ...change, value: { [property]: value } },
      }));
    }
    return [{ key: key(change, change.property || change.type), change }];
  }
  return { capture, key, entries };
}
