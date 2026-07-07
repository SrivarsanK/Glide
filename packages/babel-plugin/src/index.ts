/**
 * @srivarsank/babel-plugin — JSX source stamping.
 * Injects data-gl-source="path:line:col" onto every JSX element at dev build time.
 */

import type { PluginObj } from '@babel/core';
import * as babelCore from '@babel/core';

export default function glideSourceStampingPlugin(babel: any): PluginObj {
  const t = babel.types;

  return {
    name: 'glide-source-stamping',
    visitor: {
      JSXOpeningElement(path, state) {
        const loc = path.node.loc;
        if (!loc) return;

        const filename = (state as any).filename ?? 'unknown';
        const absolutePath = filename.replace(/\\/g, '/');
        const sourceVal = `${absolutePath}:${loc.start.line}:${loc.start.column + 1}`;

        // Check if already has data-gl-source
        const hasSourceAttr = path.node.attributes.some(
          (attr: any) =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'data-gl-source'
        );

        if (!hasSourceAttr) {
          const attr = t.jsxAttribute(
            t.jsxIdentifier('data-gl-source'),
            t.stringLiteral(sourceVal)
          );
          path.node.attributes.push(attr);
        }
      },
    },
  };
}
