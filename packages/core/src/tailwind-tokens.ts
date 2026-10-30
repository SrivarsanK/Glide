/**
 * Tailwind theme tokens — classify utility classes and map edited values back
 * to the project's own tokens. Pure functions; loading lives in tailwind-theme.ts.
 */

export interface TailwindTheme {
  version: 3 | 4 | null;
  /** Color token → resolved CSS value ('' when only the name is known). */
  colors: Map<string, string>;
  /** Color tokens the project defines, preferred over Tailwind's palette. */
  projectColors: Set<string>;
  /** Font-size token → CSS length. */
  fontSizes: Map<string, string>;
  /** Spacing token → CSS length. */
  spacing: Map<string, string>;
  /** v4 spacing multiplier (e.g. '0.25rem'): `p-6` is 6 steps. */
  spacingStep?: string;
  /** Breakpoint name → CSS length, in ascending order. */
  breakpoints: Map<string, string>;
}

const PALETTE = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const FONT_SIZES: [string, string][] = [['xs', '0.75rem'], ['sm', '0.875rem'], ['base', '1rem'], ['lg', '1.125rem'],
  ['xl', '1.25rem'], ['2xl', '1.5rem'], ['3xl', '1.875rem'], ['4xl', '2.25rem'], ['5xl', '3rem'], ['6xl', '3.75rem'],
  ['7xl', '4.5rem'], ['8xl', '6rem'], ['9xl', '8rem']];
// Keys shared by the v3 scale and v4 multiples, so either version accepts them.
const SPACING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
  44, 48, 52, 56, 60, 64, 72, 80, 96];
const BREAKPOINTS: [string, string][] = [['sm', '40rem'], ['md', '48rem'], ['lg', '64rem'], ['xl', '80rem'], ['2xl', '96rem']];

/** Tailwind's default token names. Colors carry no values, so they classify but never match. */
export function defaultTailwindTheme(): TailwindTheme {
  const colors = new Map<string, string>([['inherit', ''], ['current', ''], ['transparent', 'transparent'],
    ['black', '#000'], ['white', '#fff']]);
  for (const family of PALETTE) for (const shade of SHADES) colors.set(`${family}-${shade}`, '');
  return {
    version: null,
    colors,
    projectColors: new Set(),
    fontSizes: new Map(FONT_SIZES),
    spacing: new Map([['0', '0px'], ['px', '1px'], ...SPACING_STEPS.map(step => [String(step), `${step * 0.25}rem`] as [string, string])]),
    breakpoints: new Map(BREAKPOINTS),
  };
}

export interface RGBA { r: number; g: number; b: number; a: number }

const NAMED_COLORS: Record<string, string> = { black: '#000', white: '#fff', transparent: '#0000', red: '#f00',
  green: '#008000', blue: '#00f', yellow: '#ff0', orange: '#ffa500', purple: '#800080', gray: '#808080', grey: '#808080' };

function channel(raw: string, scale: number): number {
  return raw.endsWith('%') ? parseFloat(raw) / 100 * scale : parseFloat(raw);
}

function alpha(raw?: string): number {
  if (raw === undefined || raw === 'none') return 1;
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
}

function linearToSrgb(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255)) as [number, number, number];
}

/** Parse the CSS color forms Tailwind themes use: hex, rgb(), hsl(), oklch(). */
export function parseColor(input: string): RGBA | null {
  const value = input.trim().toLowerCase();
  if (NAMED_COLORS[value]) return parseColor(NAMED_COLORS[value]);
  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map(d => d + d).join('');
    if (digits.length !== 6 && digits.length !== 8) return null;
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? Math.round(n(6) / 255 * 100) / 100 : 1 };
  }
  const fn = value.match(/^(rgba?|hsla?|oklch)\((.*)\)$/);
  if (!fn) return null;
  const parts = fn[2].replace(/,/g, ' ').replace(/\//g, ' / ').split(/\s+/).filter(Boolean);
  const slash = parts.indexOf('/');
  const [c1, c2, c3, legacyAlpha] = slash >= 0 ? parts.slice(0, slash) : parts;
  const a = alpha(slash >= 0 ? parts[slash + 1] : legacyAlpha);
  if ([c1, c2, c3].some(part => part === undefined || Number.isNaN(parseFloat(part === 'none' ? '0' : part)))) return null;
  const num = (part: string) => parseFloat(part === 'none' ? '0' : part);
  if (fn[1].startsWith('rgb')) {
    const [r, g, b] = [c1, c2, c3].map(part => Math.round(channel(part, 255)));
    return { r, g, b, a };
  }
  if (fn[1].startsWith('hsl')) {
    const [r, g, b] = hslToRgb(num(c1), num(c2) / 100, num(c3) / 100);
    return { r, g, b, a };
  }
  const L = c1.endsWith('%') ? num(c1) / 100 : num(c1);
  const C = c2.endsWith('%') ? num(c2) / 100 * 0.4 : num(c2);
  const h = num(c3) * Math.PI / 180;
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    a,
  };
}

/** px for px/rem/em lengths (16px root) and bare numbers; null otherwise. */
export function lengthToPx(input: string | number): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const match = input.trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return match[2] === 'rem' || match[2] === 'em' ? n * 16 : n;
}

/** Strip a trailing `/opacity` or `/line-height` modifier outside brackets. */
function baseValue(suffix: string): string {
  const slash = suffix.lastIndexOf('/');
  return slash > 0 && !suffix.slice(slash).includes(']') && !suffix.slice(slash).includes(')') ? suffix.slice(0, slash) : suffix;
}

function arbitrary(suffix: string): string | null {
  const match = suffix.match(/^\[(.*)\]$/) || suffix.match(/^\((.*)\)$/);
  return match ? match[1] : null;
}

const COLOR_FUNCTION = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color\(|color-mix\()/;

/** Is this utility value (the part after `text-`, `bg-`, …) a color? */
export function isColorValue(suffix: string, theme: TailwindTheme): boolean {
  const value = baseValue(suffix);
  const inner = arbitrary(value);
  if (inner === null) return theme.colors.has(value);
  if (inner.startsWith('color:')) return true;
  if (/^[a-z-]+:/.test(inner)) return false;
  return COLOR_FUNCTION.test(inner) || Object.hasOwn(NAMED_COLORS, inner);
}

/** Is this `text-*` value a font size? */
export function isFontSizeValue(suffix: string, theme: TailwindTheme): boolean {
  const value = baseValue(suffix);
  const inner = arbitrary(value);
  if (inner === null) return theme.fontSizes.has(value);
  if (inner.startsWith('length:') || inner.startsWith('size:')) return true;
  if (/^[a-z-]+:/.test(inner)) return false;
  return lengthToPx(inner) !== null || /^(clamp|min|max|calc)\(/.test(inner);
}

/** Resolved px value of a spacing token, if the theme defines it. */
export function spacingTokenPx(token: string, theme: TailwindTheme): number | null {
  const defined = theme.spacing.get(token);
  if (defined !== undefined) return lengthToPx(defined);
  const step = theme.spacingStep && lengthToPx(theme.spacingStep);
  return step && /^\d+(\.5)?$/.test(token) ? Number(token) * step : null;
}

/** The theme's spacing token for a px length, or null when none matches exactly. */
export function spacingToken(px: number, theme: TailwindTheme): string | null {
  for (const [token, value] of theme.spacing) if (lengthToPx(value) === px) return token;
  const step = theme.spacingStep && lengthToPx(theme.spacingStep);
  if (!step || px <= 0) return null;
  const steps = px / step;
  return Number.isInteger(steps * 2) ? String(steps) : null;
}

/** The theme's font-size token for a px length, or null. */
export function fontSizeToken(px: number, theme: TailwindTheme): string | null {
  for (const [token, value] of theme.fontSizes) if (lengthToPx(value) === px) return token;
  return null;
}

/**
 * The theme's color token for a CSS color, or null. Tokens already used in
 * this scope win, then project tokens, then Tailwind's palette. Exact matches
 * only, within one 8-bit channel step to absorb color-space rounding.
 */
export function colorToken(value: string, theme: TailwindTheme, preferred: string[] = []): string | null {
  const target = parseColor(value);
  if (!target) return null;
  const order = [...new Set([...preferred, ...theme.projectColors, ...theme.colors.keys()])];
  let withOpacity: string | null = null;
  for (const name of order) {
    const raw = theme.colors.get(name);
    const color = raw ? parseColor(raw) : null;
    if (!color || ['current', 'inherit'].includes(name)) continue;
    const sameRgb = Math.abs(color.r - target.r) <= 1 && Math.abs(color.g - target.g) <= 1 && Math.abs(color.b - target.b) <= 1;
    if (!sameRgb && !(color.a === 0 && target.a === 0)) continue;
    if (Math.abs(color.a - target.a) <= 0.01) return name;
    const percent = Math.round(target.a * 100);
    if (!withOpacity && color.a === 1 && Math.abs(percent - target.a * 100) < 0.01) withOpacity = `${name}/${percent}`;
  }
  return withOpacity;
}
