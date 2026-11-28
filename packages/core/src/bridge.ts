import { trustedWindowMessage } from './window-messages.js';
import { createFrameQueries } from './frame-queries.js';
import { glideBridge } from './bridge-script.js';

/**
 * Inline bridge script injected into the browser — zero Node.js dependencies.
 * Shared by both the Vite plugin and the standalone proxy server so both paths
 * run the exact same selection, drag, preview, and frame-query logic.
 */
export function buildBridgeScript(
  sourceAttr: string,
  hoverAttr: string,
  selectedAttr: string,
  snapThresholdPx: number
): string {
  const call = `(${glideBridge.toString()})(${snapThresholdPx}, ${trustedWindowMessage.toString()}, ${createFrameQueries.toString()});`;
  // Replacer functions insert the names literally; a replacement string would expand `$&`.
  return '\n' + call
    .replace(/__GLIDE_SOURCE_ATTR__/g, () => sourceAttr)
    .replace(/__GLIDE_HOVER_ATTR__/g, () => hoverAttr)
    .replace(/__GLIDE_SELECTED_ATTR__/g, () => selectedAttr) + '\n';
}
