export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 },
];

export function resolveActiveBreakpoint(width: number): string | null {
  if (width >= 1280) {
    return 'xl';
  }
  if (width >= 1024) {
    return 'lg';
  }
  if (width >= 768) {
    return 'md';
  }
  if (width >= 640) {
    return 'sm';
  }
  return null;
}
