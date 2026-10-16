/** Shared by the shell and both injected bridges; no runtime imports. */
export function trustedWindowMessage(event: { source: unknown; origin: string; data: any }, source: unknown, url: string, base?: string): boolean {
  if (!source || event.source !== source || !url) return false;
  try {
    const origin = new URL(url, base).origin;
    if (origin === 'null' || event.origin !== origin) return false;
  } catch { return false; }
  const data = event.data;
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && typeof data.type === 'string' && data.type.startsWith('glide:') && data.type.length <= 80;
}
