// State → HTML for the desktop: the Glide editor in a browser window, a code editor window, a terminal, and the four-up split.
// Every label is copied from the real editor (packages/overlay/src/editor-html.ts) or the demo app (brag-output/work/demo-app).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ───────── layouts: side by side for 16:9, stacked for 9:16 (the X film's layout)
export let BW, CWN, TW, QW, WORLD;
export function layout(ar) {
  const f = (x, y, file, fw) => ({ x, y, w: 790, h: 790, f: file, fw });
  const Q = ['App.tsx', 'React', 'App.vue', 'Vue', 'App.svelte', 'Svelte', 'index.astro', 'Astro'];
  if (ar === '16x9') {
    WORLD = { w: 3100, h: 1700 };
    BW = { x: 40, y: 250, w: 1160, h: 960 }; CWN = { x: 1240, y: 250, w: 1140, h: 960 }; TW = { x: 560, y: 300, w: 1300, h: 860 };
    QW = [0, 1, 2, 3].map(i => f(740 + (i % 2) * 830, 40 + Math.floor(i / 2) * 830, Q[i * 2], Q[i * 2 + 1]));
  } else {
    WORLD = { w: 1700, h: 3000 };
    BW = { x: 40, y: 150, w: 1160, h: 960 }; CWN = { x: 60, y: 1120, w: 1140, h: 820 }; TW = { x: 110, y: 560, w: 1080, h: 820 };
    QW = [0, 1, 2, 3].map(i => f(40 + (i % 2) * 830, 40 + Math.floor(i / 2) * 830, Q[i * 2], Q[i * 2 + 1]));
  }
}

export const desk = () => `<div class="wall" style="width:${WORLD.w}px;height:${WORLD.h}px"></div>`;

// ───────── browser window with the Glide editor
export function browser(S) {
  const E = S.ed;
  return `<div class="win bw" style="left:${BW.x}px;top:${BW.y}px;width:${BW.w}px;height:${BW.h}px">
  <div class="tabs"><div class="dots"><i></i><i></i><i></i></div>
    <div class="tab" data-a="tab"><span class="fav">${favicon()}</span><span data-a="tabtitle">Glide — Code-Native Visual Designer</span></div></div>
  <div class="addr"><span>127.0.0.1:5173/__glide/</span></div>
  <div class="ed">
    <div class="bar1"><span class="ic">${favicon(16)}</span><span class="ic sq"></span><span class="ic sq"></span><span class="ic${E.histBtn ? ' hot' : ''}" data-a="histbtn">◷</span>
      <span class="file"><b>${E.file}</b><small>git: <em>main</em> ▾</small></span><span class="sp"></span>
      <span class="dd w">Tablet ▾</span><span class="dim">W <b>768</b> × H <b>1024</b></span><span class="zoom">– <b>95%</b> + <i>Fit</i></span></div>
    <div class="bar2"><span class="url">URL <b>http://localhost:5173</b></span><span class="bx conn">Connected</span><span class="bx">Preview</span><span class="bx">Move to canvas</span>
      <span class="pillw"><span class="${E.mode === 'staged' ? '' : 'on'}">● Instant</span><span data-a="staged" class="${E.mode === 'staged' ? 'on st2' : ''}">● Staged</span></span><span class="ic sq"></span><span class="ic sq"></span><span class="ic sq"></span><span class="ic sq"></span></div>
    ${canvas(S)}
    ${panel(S)}
    <div class="st"><i></i>Ready<span class="sp"></span>V=Select H=Hand F=Frame T=Text</div>
  </div></div>`;
}
function favicon(s = 18) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M14 4 L14 17 L17 14 L19 19 L21 18 L19 13 L23 13 Z" fill="none" stroke="#777" stroke-width="1.2"/><path d="M9 4 L9 17 L12 14 L14 19 L16 18 L14 13 L18 13 Z" fill="none" stroke="#999" stroke-width="1.2"/><path d="M3 3 L3 18 L6.5 14.5 L9 20 L11.5 19 L9 13.5 L14 13.5 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
}

// the demo app (brag-output/work/demo-app), at the Tablet preset: 768 px wide, scaled 0.95
function canvas(S) {
  const E = S.ed, sel = k => E.sel === k ? ' sl' : '';
  const ticks = Array.from({ length: 17 }, (_, i) => `<span style="left:${32 + i * 48}px">${(i - 1) * 50}</span>`).join('');
  return `<div class="cv"><div class="rul">${ticks}</div>
    <div class="pg">
      <div class="nav"><b>SrivarsanK</b><span>Work</span><span>Glide</span><span>Contact</span></div>
      <section class="hero">
        <p class="eb">Full-Stack / AI Developer</p>
        <h1 data-a="h1" class="${sel('h1')}${E.h1Edit ? ' ed1' : ''}" style="color:${E.h1Col};font-size:${E.h1Size}px"><span data-a="h1t">${esc(E.h1Text)}${E.h1Edit ? '<i class="caret dk"></i>' : ''}</span></h1>
        <p class="sub${sel('sub')}" style="transform:translate(${E.subDX}px,${E.subDY}px);font-size:${E.subSize}px;line-height:1.4"><span data-a="sub">${esc(E.subText)}</span></p>
        <div class="btns"><span data-a="btn1" class="b1${sel('btn1')}" style="font-size:${E.btnText}px">View the repo</span><span data-a="btn2" class="b2" style="font-size:${E.btnText}px">Get in touch</span></div>
      </section>
      <div class="cards">${[['Glide', 'Visual editor that writes to your source files.'], ['React · Vue · Svelte', 'One canvas for every framework.'], ['Open source', 'Apache 2.0. Contributions welcome.']]
        .map(([t, b], i) => `<article data-a="card${i}" class="${i === 0 ? sel('card') : ''}"><h3>${t}</h3><div data-a="cardbody${i}">${b}</div></article>`).join('')}</div>
    </div>
    ${E.guide > 0 ? `<div class="guide" style="left:${45 + 61 + E.subDX * .95}px;opacity:${E.guide}"></div>` : ''}
    ${E.toast ? `<div class="tst${E.toast.err ? ' err' : ''}" data-a="toast" style="opacity:${E.toast.op}">${E.toast.text}</div>` : ''}
    ${E.staged ? stagingBar(E.staged) : ''}
    ${E.history ? historyPanel(E.history) : ''}
  </div>`;
}
// STAGED EDITS ACTION BAR (editor-html.ts: staging-count, staging-toggle-preview, staging-discard-btn, staging-apply-btn)
const stagingBar = G => `<div class="sbar" data-a="sbar" style="opacity:${G.op};transform:translate(-50%,${(1 - G.op) * 16}px)">
  <span class="sbadge"><i></i>${G.n} change${G.n > 1 ? 's' : ''} staged</span>
  <span class="sbtn${G.hot === 'prev' ? ' dn' : ''}" data-a="sprev">◉ ${G.label}</span><span class="sbtn red">⌫ Discard</span><span class="sbtn pri${G.hot === 'apply' ? ' dn' : ''}" data-a="sapply">✓ Apply Changes</span></div>`;
// HISTORY panel: the initial-state row, then one "Apply source changes" row per write (ws-server.ts)
const historyPanel = H => `<div class="hist" style="opacity:${H.op};transform:translateX(${(1 - H.op) * -30}px)">
  <div class="hh"><span>← back</span><b>HISTORY</b><span class="dim">clear</span></div>
  <div class="hr${H.cur === -1 ? ' cur' : ''}"><i>●</i>[initial state]</div>
  ${Array.from({ length: H.n }, (_, i) => `<div class="hr${H.cur === i ? ' cur' : ''}${i > H.cur ? ' fut' : ''}" data-a="hrow${i}"><i>${i <= H.cur ? '●' : '○'}</i>Apply source changes<small>just now</small></div>`).join('')}</div>`;

function panel(S) {
  const E = S.ed, btn = E.props === 'button';
  const opts = ['Every &lt;Button&gt; · Button.tsx:23', 'This &lt;Button&gt; · App.tsx:27', 'Every &lt;Button variant="primary"&gt;', 'Every &lt;Button size="lg"&gt;'];
  return `<div class="rp">
    <div class="sel3"><span data-a="bp" class="dd${E.bp === 'md' ? ' on' : ''}">${E.bp === 'md' ? 'md' : 'Base'} ▾</span><span class="dd">Default ▾</span><span class="dd">Tailwind ▾</span></div>
    ${btn ? `<div class="dd wide${E.scope.hot ? ' on' : ''}" data-a="scope">${E.scope.val} ▾</div>` : ''}
    ${btn && E.scope.op > 0 ? `<div class="opts" style="opacity:${E.scope.op};transform:translateY(${(1 - E.scope.op) * -8}px)">${opts.map((o, i) =>
      `<span data-a="opt${i}" class="${E.scope.pick === i ? 'hi' : ''}">${o}</span>`).join('')}</div>` : ''}
    <div class="props">Properties <code>&lt;${btn ? 'button' : E.props === 'p' ? 'p' : 'h1'}&gt;</code></div>
    <div class="sec"><h6>Typography</h6>
      <div class="fld">T&nbsp; system-ui, sans-serif</div>
      <div class="row"><div class="fld">${btn ? 'Medium' : 'Bold'} <span class="sp"></span>⌄</div><div class="fld${E.sizeHot ? ' hot' : ''}" data-a="size"><small>⇕</small>${E.sizeField}${E.sizeHot ? '<i class="caret"></i>' : ''}</div></div>
      <div class="row"><div class="fld"><small>↕</small>${btn ? 28 : E.h1Size}</div><div class="fld"><small>↔</small>${btn ? 0 : -1}</div></div>
      <div class="row al"><span class="on"></span><span></span><span></span><span></span></div>
      <div class="fld clr" data-a="color"><i style="background:${E.colorHex}"></i>${E.colorHex}</div>
    </div>
    ${E.picker && E.picker.op > 0 ? picker(E.picker) : ''}
  </div>`;
}
const SW = ['#000000', '#ffffff', '#f8fafc', '#94a3b8', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#0ea5e9', '#a855f7', '#f43f5e'];
const picker = P => `<div class="pk" style="opacity:${P.op}"><div class="g">${SW.map((c, i) => `<i data-a="sw${i}" class="${P.sw === i ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div>
  <div class="row"><span class="big" style="background:${P.col || P.hex}"></span><span class="hex">${P.hex}</span></div><div class="apply${P.press ? ' dn' : ''}" data-a="apply">Apply</div></div>`;

// ───────── code editor window (generic editor chrome; the text is the real file)
const FILES = { 'App.tsx': 'demo-app / src', 'Button.tsx': 'demo-app / src / components', 'vite.config.ts': 'demo-app' };
export function codeWin(S) {
  const C = S.code, rows = C.file === 'Button.tsx' ? buttonLines(C) : C.file === 'vite.config.ts' ? viteLines(C) : appLines(C);
  return `<div class="win cw" style="left:${CWN.x}px;top:${CWN.y}px;width:${CWN.w}px;height:${CWN.h}px">
    <div class="ctabs"><div class="dots"><i></i><i></i><i></i></div>${(C.tabs || ['App.tsx', 'Button.tsx']).map(f => `<span class="ctab${f === C.file ? ' on' : ''}">${f}${C.dirty && f === C.file ? ' ●' : ''}</span>`).join('')}
      <span class="sp"></span><span class="crumb">${FILES[C.file]}</span></div>
    <div class="code">${rows.join('')}</div></div>`;
}
const line = (n, html, mark) => `<div class="ln" data-a="ln${n}"><b class="${mark ? 'mk' : ''}">${n}</b><span class="t">${html}</span></div>`;
// light syntax colouring for the plain lines
// markers first, HTML last, so inserted class="…" quotes are never re-matched as strings
function hl(s) {
  return esc(s).replace(/"([^"]*)"/g, '\u0001$1\u0002').replace(/'([^']*)'/g, '\u0006$1\u0007').replace(/(className|size|variant|key|title)=/g, '\u0003$1\u0004=').replace(/&lt;(\/?)(\w+)/g, '&lt;$1\u0005$2\u0004')
    .replace(/\b(import|from|export|default|const|return|function)\b/g, '\u0008$1\u0004')
    .replace(/\u0001/g, '<i class="sv">"').replace(/\u0002/g, '"</i>').replace(/\u0006/g, `<i class="sv">'`).replace(/\u0007/g, `'</i>`)
    .replace(/\u0003/g, '<i class="at">').replace(/\u0005/g, '<i class="tg">').replace(/\u0008/g, '<i class="kw">').replace(/\u0004/g, '</i>');
}
// a token that can crumble, be typed, or be replaced
function tok(key, T) {
  if (!T || T.hide) return '';
  // the untyped rest keeps its width, so the line never rewraps while a token is written
  const n = T.n !== undefined ? T.n : T.text.length, rest = T.text.slice(n);
  return `<span class="tk${T.cls ? ' ' + T.cls : ''}" data-a="tk-${key}" style="${T.op !== undefined ? `opacity:${T.op};` : ''}">${esc(T.text.slice(0, n))}${rest ? `<span style="opacity:0">${esc(rest)}</span>` : ''}${T.caret ? '<i class="caret"></i>' : ''}</span>`;
}
const APP = { 22: `      <section className="mt-24 max-w-3xl">`, 23: `        <p className="text-sm font-medium text-slate-500">Full-Stack / AI Developer</p>`,
  26: `        <div className="mt-10 flex gap-4">`, 27: `          <Button size="lg">View the repo</Button>`, 28: `          <Button variant="outline" size="lg">Get in touch</Button>`,
  29: `        </div>`, 30: `      </section>`, 31: ``, 32: `      <section className="mt-24 grid grid-cols-3 gap-6">`, 33: `        {work.map(([title, body]) => (`,
  34: `          <Card key={title} title={title}>{body}</Card>`, 35: `        ))}`, 36: `      </section>` };
function appLines(C) {
  const K = C.tok, rows = [];
  for (let n = C.from || 22; n <= 36; n++) {
    let h;
    if (n === 24) h = `        &lt;<i class="tg">h1</i> <i class="at">className</i>=<i class="sv">"mt-4 ${tok('5xl', K['5xl'])} ${tok('md6', K.md6)}${tok('md7', K.md7)} font-bold tracking-tight ${tok('slate', K.slate)}${tok('brand', K.brand)}"</i>&gt;${tok('h1txt', K.h1txt)}&lt;/<i class="tg">h1</i>&gt;`;
    else if (n === 25) h = `        &lt;<i class="tg">p</i> <i class="at">className</i>=<i class="sv">"mt-6 ${tok('xl', K.xl)}${tok('2xl', K['2xl'])} text-slate-600${K.style && !K.style.hide ? ' ' + tok('style', K.style) : ''}"</i>&gt;${tok('subtxt', K.subtxt)}${tok('subadd', K.subadd)}${tok('subend', K.subend)}&lt;/<i class="tg">p</i>&gt;`;
    else h = hl(APP[n]);
    rows.push(line(n, h, C.mark[n]));
  }
  return rows;
}
function buttonLines(C) {
  const K = C.tok;
  return [line(6, hl(`const buttonVariants = cva('inline-flex items-center justify-center rounded-md font-medium', {`)), line(7, `  variants: {`), line(8, `    variant: {`),
    line(9, `      primary: <i class="sv">'bg-brand-500 text-white'</i>,`), line(10, `      outline: <i class="sv">'border border-slate-300 text-slate-800'</i>,`), line(11, `    },`),
    line(12, `    size: {`), line(13, `      sm: <i class="sv">'h-8 px-3 text-sm'</i>,`),
    line(14, `      lg: <i class="sv">'h-12 px-6 ${tok('base', K.base)}${tok('lg', K.lg)}'</i>,`, C.mark[14]),
    line(15, `    },`), line(16, `  },`), line(17, `  defaultVariants: { variant: <i class="sv">'primary'</i>, size: <i class="sv">'sm'</i> },`), line(18, `})`)];
}
// the demo app's real vite.config.ts; line 4 and the plugin call are typed in during the setup scene
function viteLines(C) {
  const K = C.tok;
  return [line(1, hl(`import react from '@vitejs/plugin-react'`)), line(2, hl(`import tailwindcss from '@tailwindcss/vite'`)), line(3, hl(`import { defineConfig } from 'vite'`)),
    line(4, tok('vimp', K.vimp), C.mark[4]), line(5, ''), line(6, hl(`export default defineConfig({`)),
    line(7, `  plugins: [react(), tailwindcss()${tok('vplug', K.vplug)}],`, C.mark[7]), line(8, `})`)];
}

// ───────── terminal: rows of { p: prompt + typed text, caret } or plain output lines
export function term(S) {
  const T = S.term;
  return `<div class="win tw" style="left:${TW.x}px;top:${TW.y}px;width:${TW.w}px;height:${TW.h}px;opacity:${T.op};transform:translateY(${(1 - T.op) * 60}px)">
    <div class="ctabs" data-a="termbar"><div class="dots"><i></i><i></i><i></i></div><span class="ttl">demo-app — zsh</span></div>
    <div class="tx">${T.rows.map((r, i) => r.p !== undefined ? `<div data-a="trow${i}"><i class="pr">~/demo-app $</i> <span data-a="tcmd${i}">${esc(r.p)}</span>${r.caret ? '<i class="caret"></i>' : ''}</div>`
      : `<div data-a="trow${i}" class="o${r.hi ? ' hi' : ''}">${r.html || esc(r.text)}</div>`).join('')}</div></div>`;
}

// ───────── four-up: the same edit in each test app (glide-test-apps)
export function quad(S) {
  const Q = S.quad;
  return QW.map((w, i) => {
    const k = Q.k[i], sc = Q.in[i];
    return `<div class="win qw" style="left:${w.x}px;top:${w.y}px;width:790px;height:790px;opacity:${Math.min(1, sc * 1.5)};transform:scale(${.85 + .15 * sc})">
      <div class="tabs"><div class="dots"><i></i><i></i><i></i></div><div class="tab"><span class="fav">${favicon()}</span>Glide — Code-Native Visual Designer</div></div>
      <div class="qbar"><b>${w.f}</b><small>git: <em>main</em> ▾</small><span class="sp"></span><span class="fwtag">${w.fw}</span></div>
      <div class="qcv"><div class="qpg">
        <header data-a="qh${i}" class="${k > 0 ? 'sl' : ''}" style="background:${k > .5 ? '#6d28d9' : '#0f172a'}"><b>Building Glide.</b><small>Edit me</small></header>
        <div class="qbox"><i style="background:#f87171"></i><i style="background:#60a5fa"></i><i style="background:#4ade80"></i></div>
        <div class="qresp"><b>Responsive box</b><i></i></div></div></div></div>`;
  }).join('');
}
