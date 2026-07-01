import * as pretext from '@chenglou/pretext';

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class MockOffscreenCanvas {
    constructor() {}
    getContext() {
      return {
        measureText: (text: string) => ({ width: text.length * 8 }),
      };
    }
  } as any;
}

export interface MeasureResult {
  width: number;
  lineCount: number;
  lines: string[];
}

export function measureTextLayout(text: string, font: string, maxWidth: number): MeasureResult {
  const prepared = pretext.prepareWithSegments(text, font, undefined);
  const layoutResult = pretext.layoutWithLines(prepared, maxWidth, 20);
  
  return {
    width: pretext.measureNaturalWidth(prepared),
    lineCount: layoutResult.lineCount,
    lines: layoutResult.lines.map((l: any) => l.text.trim()),
  };
}
