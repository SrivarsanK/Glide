/** Translate a completed gesture into authored CSS without changing its layout model. */
export function layoutStyles(value: unknown, position = 'static'): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_LAYOUT: Expected layout properties.');
  if (!['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(position)) throw new Error('UNSUPPORTED_LAYOUT: Unknown positioning model.');
  const styles: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!['left', 'top', 'width', 'height'].includes(key) || typeof raw !== 'string' || !/^-?\d+(?:\.\d+)?px$/.test(raw)) {
      throw new Error('INVALID_LAYOUT: Layout values must be finite pixel lengths.');
    }
    if (!Number.isFinite(parseFloat(raw)) || (['width', 'height'].includes(key) && parseFloat(raw) <= 0)) throw new Error('INVALID_LAYOUT: Invalid size.');
    styles[key] = raw;
  }
  if (!Object.keys(styles).length) throw new Error('INVALID_LAYOUT: Empty gesture.');
  if ('left' in styles || 'top' in styles) {
    if (position === 'sticky') throw new Error('UNSUPPORTED_LAYOUT: Dragging sticky elements would change their scroll constraints.');
    // Relative offsets preserve flex/grid membership and the occupied flow box.
    styles.position = position === 'static' ? 'relative' : position;
  }
  return styles;
}
