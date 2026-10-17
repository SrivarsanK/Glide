export interface MutationScope {
  breakpoint?: string;
  pseudoState?: string;
  authoringRepresentation?: 'tailwind' | 'inline';
}

/** Split variants without treating colons inside arbitrary values as separators. */
export function splitClassVariants(token: string): string[] {
  const parts: string[] = [];
  let start = 0, depth = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '\\') { i++; continue; }
    if (token[i] === '[' || token[i] === '(') depth++;
    if (token[i] === ']' || token[i] === ')') depth--;
    if (token[i] === ':' && depth === 0) { parts.push(token.slice(start, i)); start = i + 1; }
  }
  parts.push(token.slice(start));
  return parts;
}

export function mutationVariants(scope: MutationScope): string[] {
  const breakpoint = scope.breakpoint?.replace(/:$/, '') || '';
  const pseudo = scope.pseudoState?.replace(/:$/, '') || '';
  if (breakpoint && !['sm', 'md', 'lg', 'xl', '2xl'].includes(breakpoint)) throw new Error('UNSUPPORTED_SCOPE: Unknown breakpoint.');
  if (pseudo && !['hover', 'focus', 'focus-visible', 'active', 'disabled'].includes(pseudo)) throw new Error('UNSUPPORTED_SCOPE: Unknown pseudo-state.');
  if (scope.authoringRepresentation && !['tailwind', 'inline'].includes(scope.authoringRepresentation)) throw new Error('UNSUPPORTED_SCOPE: Unknown authoring representation.');
  if ((breakpoint || pseudo) && scope.authoringRepresentation === 'inline') throw new Error('UNSUPPORTED_SCOPE: Inline styles cannot represent responsive or pseudo-state edits.');
  return [breakpoint, pseudo].filter(Boolean);
}
