# On-screen code and UI strings: where each comes from

Checked 19 Nov against `main` (794aa17), running `@srivarsank/ast-writer`'s `transformJSXBatch` in memory on `brag-output/work/demo-app/src/App.tsx`. No files were written.

| Beat | On screen | Source |
|---|---|---|
| Drag (13.0–14.8 s) | `className="mt-6 text-xl text-slate-600 left-[48px] top-[0px] relative"` | writer, `layout` change `{left:'48px', top:'0px'}`, `authoringRepresentation: 'tailwind'` (the panel shows Style format = Tailwind), App.tsx:25 |
| Drag, inline format (not used) | `style={{ left: '48px', top: '0px', position: 'relative' }}` | same, inline authoring |
| Refusal (15.0 s) | `Select one literal text segment. The element has no unique text target.` | writer `mutateText`, a text edit on `<Card>{body}</Card>` (App.tsx:34); the child is an identifier, not a literal |
| Scope list (9.5 s) | `Every <Button> · Button.tsx:23`, `This <Button> · App.tsx:27`, `Every <Button variant="primary">`, `Every <Button size="lg">`; default `This <Button>` | `acceptEditScopes` in `packages/overlay/src/editor-html.ts` (Tailwind format defaults to the outermost usage) |
| Scope diff | `Button.tsx:14 lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'` | 15 Nov capture |

Note: the boards showed the inline form. The film switched to the class form because its panel shows Style format = Tailwind, and that is what Glide writes in that mode.
