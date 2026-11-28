/**
 * @srivarsank/babel-plugin — JSX source stamping.
 * Injects data-gl-source="path:line:col" onto every JSX element at dev build time.
 */

import type { PluginObj } from '@babel/core';

function isReactFragment(path: any): boolean {
  const name = path.node.name;
  if (!name) return false;
  if (name.type === 'JSXMemberExpression') {
    return name.property?.type === 'JSXIdentifier' && name.property.name === 'Fragment';
  }
  if (name.type === 'JSXIdentifier') {
    if (name.name === 'Fragment') return true;
    const binding = path.scope?.getBinding(name.name);
    if (binding?.path?.isImportSpecifier?.()) {
      const imported = binding.path.node.imported;
      const importedName = imported?.type === 'Identifier' ? imported.name : imported?.value;
      const source = binding.path.parentPath?.node?.source?.value;
      if (importedName === 'Fragment' && (source === 'react' || source === 'react/jsx-runtime')) {
        return true;
      }
    }
  }
  return false;
}

export default function glideSourceStampingPlugin(babel: any): PluginObj {
  const t = babel.types;

  return {
    name: 'glide-source-stamping',
    visitor: {
      JSXOpeningElement(path, state) {
        const opts = (state.opts ?? {}) as { sourceAttribute?: string; enabled?: boolean; force?: boolean };
        if (opts.enabled === false) return;
        if (process.env.NODE_ENV === 'production' && opts.force !== true) return;
        if (isReactFragment(path)) return;

        const loc = path.node.loc;
        if (!loc) return;

        const filename = (state as any).filename ?? 'unknown';
        const absolutePath = filename.replace(/\\/g, '/');
        const sourceVal = `${absolutePath}:${loc.start.line}:${loc.start.column + 1}`;

        const sourceAttr = opts.sourceAttribute ?? 'data-gl-source';
        // Check if already has data-gl-source
        const hasSourceAttr = path.node.attributes.some(
          (attr: any) =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === sourceAttr
        );

        if (!hasSourceAttr) {
          const attr = t.jsxAttribute(
            t.jsxIdentifier(sourceAttr),
            t.stringLiteral(sourceVal)
          );
          path.node.attributes.push(attr);
        }
      },
    },
  };
}
