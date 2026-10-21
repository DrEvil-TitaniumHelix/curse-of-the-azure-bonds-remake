// byoc-ui.js — the game-file screens BY-1..BY-5 (+ the BY-6 test-party button) of docs/BYOC.md §5, drawn on a 320x200
// overlay canvas laid exactly over the game canvas, in the game's text-grid style (ega.js). Back end: engine/byoc.js
// (API in its header; changes come as `byoc api #n` in STATUS.md).
//
//   ensureGameFiles(byoc)  boot gate, called by main.js openGameFiles when nothing is imported and no dev data answers:
//                      BY-1 Import -> BY-2 Checking -> BY-3 OK / BY-4 Failed; resolves after Start (files stored, or kept
//                      for this session: byoc.sessionActive()).
//   mountSettings(byoc)    the gear outside the canvas (and gamepad Menu button 9) -> BY-5 Settings / Game files.
//
// Input: keyboard (arrows / Tab move, Enter / Space choose, Esc / Backspace back, the white hotkey letter, PgUp / PgDn
// scroll a list), mouse / touch (point = focus, click = choose, wheel = scroll, right-click = back), gamepad (d-pad or
// left stick move, A choose, B back, LB / RB scroll). File pickers need a click, tap or key (browsers do not let a gamepad
// button open one), so a pad press on a picker item only says so.
//
// Headless hooks (screenshots): ?screen=BY-n sets window.__screenReady when that screen is drawn; ?byocmock=<case> swaps
// in a canned back end (mock.js); ?byocsrc=<url> imports from that URL (byoc.collectFromUrl) without a picker.

import { EgaScreen, C, COLS, wrap } from './ega.js';
import { makeZip, readZip } from './zip.js';

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const LEFT = 2, WIDTH = 36;            // text area: columns 2..37 inside the frame
let B = null;                          // the byoc back end (engine/byoc.js or mock)
// cab: PER-12 — game name, version, file count and id prefix from the back end (engine/byoc.js gameInfo, set from the
// profile by configure()); Pool's texts are the defaults
const GI = () => (B && B.gameInfo) || { title: 'Pool of Radiance', version: '1.3', prefix: 'por', daxCount: 113, credits: 'the version shown in the credits' };

async function backend(mod) {
  if (B) return B;
  if (q.get('byocmock')) B = (await import('./mock.js')).mockByoc(q.get('byocmock'));
  else B = mod || await import('../../engine/byoc.js');
  return B;
}

// ---- the overlay ----------------------------------------------------------------------------------------------------
const ui = {
  root: null, scr: null, screen: null, focus: 0, busy: false, message: '', listTop: 0,
  onClose: null, pad: {}, padTimer: 0, padVia: false,
};

function ensureRoot() {
  if (ui.root) return;
  const root = document.createElement('div');
  root.id = 'byoc-ui';
  root.style.cssText = 'position:fixed;z-index:20;background:#000;display:none;touch-action:none;';
  const cv = document.createElement('canvas');
  cv.id = 'byoc-screen';
  cv.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;cursor:default;';
  root.appendChild(cv);
  document.body.appendChild(root);
  ui.root = root;
  ui.scr = new EgaScreen(cv);
  addEventListener('resize', place);
  addEventListener('keydown', onKey, true);
  cv.addEventListener('pointermove', (e) => { const it = itemAt(e); if (it >= 0 && it !== ui.focus) { ui.focus = it; draw(); } });
  cv.addEventListener('click', (e) => { const it = itemAt(e); if (it >= 0) { ui.focus = it; choose('pointer'); } });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); back(); });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); scroll(e.deltaY > 0 ? 3 : -3); }, { passive: false });
  root.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    if (ui.busy || !ui.screen || !ui.screen.drop) return;
    const dt = e.dataTransfer;
    runImport(async () => (await backend()).collectFromDataTransfer(dt));
  });
}

// same integer scale and position as the game canvas (index.html fit())
function place() {
  if (!ui.root) return;
  const game = document.getElementById('screen');
  let r = game && game.getBoundingClientRect();
  if (!r || !r.width) {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / 320, innerHeight / 200)));
    r = { left: (innerWidth - 320 * s) / 2, top: (innerHeight - 200 * s) / 2, width: 320 * s, height: 200 * s };
  }
  Object.assign(ui.root.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}

function show(screen, focusKey) {
  ensureRoot();
  ui.screen = screen; ui.listTop = 0; ui.message = screen.message || '';
  const items = screen.items || [];
  const f = focusKey ? items.findIndex((i) => i.key === focusKey) : -1;
  ui.focus = f >= 0 ? f : Math.max(0, items.findIndex((i) => !i.disabled));
  ui.root.style.display = 'block';
  place();
  startPad();
  draw();
}
function hide() {
  if (!ui.root) return;
  ui.root.style.display = 'none'; ui.screen = null;
}
function say(msg) { ui.message = msg; draw(); }

// ---- drawing --------------------------------------------------------------------------------------------------------
// screen = { id, title, body: [string | {text, colour}], list: {lines: [{text, colour}], rows}, items: [{key, label, run,
//            picker, disabled}], prompt, back, drop }
function layout(s) {
  const out = { body: [], list: null, items: [] };
  let row = 3;
  for (const b of s.body || []) {
    const t = typeof b === 'string' ? { text: b, colour: C.text } : b;
    if (t.text === '') { row++; continue; }
    if (t.label !== undefined) out.body.push({ row, col: LEFT, text: t.label, colour: C.text });   // key / value rows
    for (const line of wrap(t.text, t.indent ? WIDTH - t.indent : WIDTH)) out.body.push({ row: row++, col: LEFT + (t.indent || 0), text: line, colour: t.colour ?? C.text });
  }
  if (s.list) {
    row++;
    if (s.list.head) { out.body.push({ row: row++, col: LEFT, text: s.list.head, colour: C.dim }); }
    out.list = { row, rows: s.list.rows };
    row += s.list.rows;
  }
  row++;
  for (const it of s.items || []) out.items.push({ row: row++, col: LEFT + 1, len: it.label.length });
  if (row > 23) console.warn(`byoc-ui: screen ${s.id} overflows the frame (row ${row})`);
  return out;
}

function draw() {
  const s = ui.screen, e = ui.scr;
  if (!s) return;
  const L = (s._layout = layout(s));
  e.clear(0);
  e.frame();
  e.text(LEFT, 1, s.title.toUpperCase().slice(0, WIDTH), C.title);
  for (const b of L.body) e.text(b.col, b.row, b.text, b.colour);
  if (L.list) {
    const lines = s.list.lines, n = L.list.rows;
    ui.listTop = Math.max(0, Math.min(ui.listTop, lines.length - n));
    for (let i = 0; i < n && ui.listTop + i < lines.length; i++) {
      const l = lines[ui.listTop + i];
      e.text(LEFT, L.list.row + i, l.text.slice(0, WIDTH - 1), l.colour ?? C.text);
    }
    if (lines.length > n) {                                   // scroll marks in the last column
      if (ui.listTop > 0) e.glyph(LEFT + WIDTH - 1, L.list.row, 0x1E, C.mark);
      if (ui.listTop + n < lines.length) e.glyph(LEFT + WIDTH - 1, L.list.row + n - 1, 0x1F, C.mark);
    }
  }
  if (s.progress) {                                           // BY-2 bar: 36 columns, green on dark grey
    const { done, total } = s.progress, y = s.progress.row * 8 + 1, w = WIDTH * 8;
    e.rect(LEFT * 8, y, w, 6, C.barBg);
    e.rect(LEFT * 8, y, Math.round(w * done / Math.max(1, total)), 6, C.bar);
  }
  (s.items || []).forEach((it, i) => {
    const p = L.items[i], on = i === ui.focus && !ui.busy;
    if (on) e.glyph(p.col - 1, p.row, 0x10, C.mark);           // ► marks the focused option
    for (let k = 0; k < it.label.length; k++) {
      const ch = it.label[k];
      const col = it.disabled ? C.dim : on ? C.hot : (k === 0 ? C.hot : C.item);
      e.glyph(p.col + k, p.row, ch.charCodeAt(0), col);
    }
  });
  const prompt = (ui.busy ? 'PLEASE WAIT...' : ui.message || s.prompt || 'CHOOSE A FUNCTION').toUpperCase();
  const lines = wrap(prompt, COLS);
  e.text(0, 24, lines[0].slice(0, COLS), C.prompt);
  e.present();
  if (q.get('screen') === s.id && !ui.busy && typeof window !== 'undefined') { window.__screenReady = true; window.__screenId = s.id; }
}

// ---- input ----------------------------------------------------------------------------------------------------------
function itemAt(ev) {
  const s = ui.screen; if (!s || !s._layout || ui.busy) return -1;
  const r = ui.scr.canvas.getBoundingClientRect();
  const col = Math.floor((ev.clientX - r.left) / r.width * 40), row = Math.floor((ev.clientY - r.top) / r.height * 25);
  return s._layout.items.findIndex((p, i) => p.row === row && col >= p.col - 1 && col < p.col + p.len && !s.items[i].disabled);
}
function move(d) {
  const items = (ui.screen && ui.screen.items) || [];
  if (!items.length) return;
  let i = ui.focus;
  for (let k = 0; k < items.length; k++) { i = (i + d + items.length) % items.length; if (!items[i].disabled) break; }
  ui.focus = i; ui.message = ''; draw();
}
function scroll(d) { if (ui.screen && ui.screen.list) { ui.listTop += d; draw(); } }
async function choose(via) {
  const it = ui.screen && ui.screen.items && ui.screen.items[ui.focus];
  if (!it || it.disabled || ui.busy) return;
  if (it.picker && via === 'pad') { say('PRESS ENTER, CLICK OR TAP: THE BROWSER OPENS PICKERS ONLY THEN'); return; }
  ui.message = '';
  try { await it.run(via); } catch (e) { ui.busy = false; say('ERROR: ' + String((e && e.message) || e)); }
}
function back() { if (!ui.busy && ui.screen && ui.screen.back) ui.screen.back(); }

function onKey(e) {
  if (!ui.screen || ui.root.style.display === 'none') return;
  e.stopImmediatePropagation();                               // the game (input.js, bubble phase) must not see it
  const k = e.key;
  const handled = () => e.preventDefault();
  if (ui.busy) { if (k === 'Escape' && ui.screen.cancel) { handled(); ui.screen.cancel(); } return; }
  if (k === 'ArrowUp' || (k === 'Tab' && e.shiftKey)) { handled(); move(-1); }
  else if (k === 'ArrowDown' || k === 'Tab') { handled(); move(1); }
  else if (k === 'Enter' || k === ' ') { handled(); choose('key'); }
  else if (k === 'Escape' || k === 'Backspace') { handled(); back(); }
  else if (k === 'PageUp') { handled(); scroll(-(ui.screen.list ? ui.screen.list.rows - 1 : 1)); }
  else if (k === 'PageDown') { handled(); scroll(ui.screen.list ? ui.screen.list.rows - 1 : 1); }
  else if (k === 'Home') { handled(); ui.listTop = 0; draw(); }
  else if (k === 'End') { handled(); ui.listTop = 1e9; draw(); }
  else if (k.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const i = (ui.screen.items || []).findIndex((it) => !it.disabled && it.label[0] === k.toUpperCase());
    if (i >= 0) { handled(); ui.focus = i; choose('key'); }
  }
}

// gamepad: own poll while a screen is up (button 9 = Menu opens / closes BY-5 during the game, see mountSettings)
let padRunning = false;
function startPad() {
  if (padRunning || typeof navigator === 'undefined' || !navigator.getGamepads) return;
  padRunning = true;
  const poll = () => {
    const now = performance.now();
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const v = {
        up: btn(12) || (pad.axes[1] ?? 0) < -0.6, down: btn(13) || (pad.axes[1] ?? 0) > 0.6,
        a: btn(0), b: btn(1), lb: btn(4), rb: btn(5), menu: btn(9),
      };
      for (const [name, on] of Object.entries(v)) {
        const id = pad.index + name, was = ui.pad[id];
        const repeat = on && was && (name === 'up' || name === 'down') && now - ui.padTimer > 180;
        if (on && (!was || repeat)) { ui.padTimer = now + (was ? 0 : 220); padPress(name); }
        ui.pad[id] = on;
      }
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
function padPress(name) {
  if (name === 'menu') { if (globalThis.goldBoxPlus) return; if (settingsHook) settingsHook(); return; }
  if (!ui.screen || ui.root.style.display === 'none') return;
  if (ui.busy) { if (name === 'b' && ui.screen.cancel) ui.screen.cancel(); return; }
  if (name === 'up') move(-1); else if (name === 'down') move(1);
  else if (name === 'a') choose('pad'); else if (name === 'b') back();
  else if (name === 'lb') scroll(-4); else if (name === 'rb') scroll(4);
}

// ---- pickers --------------------------------------------------------------------------------------------------------
function pickFiles({ directory, accept }) {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
    if (directory) inp.webkitdirectory = true;
    if (accept) inp.accept = accept;
    inp.addEventListener('change', () => { res(inp.files); inp.remove(); });
    inp.addEventListener('cancel', () => { res(null); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}
const hasDirPicker = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

// ---- the import flow (BY-1 -> BY-2 -> BY-3 / BY-4) --------------------------------------------------------------------
let flow = null;   // { done(result), context: 'boot' | 'settings', notice }

function screenImport() {
  const items = [];
  if (hasDirPicker()) items.push({ key: 'C', label: 'CHOOSE FOLDER', picker: true, run: () => runImport(async () => {
    let h;
    try { h = await window.showDirectoryPicker({ id: `${GI().prefix}-game`, mode: 'read' }); }
    catch (e) { if (e && e.name === 'AbortError') return null; throw e; }
    return (await backend()).collectFromDirectoryHandle(h);
  }) });
  items.push({ key: 'S', label: hasDirPicker() ? 'SELECT FILES OR FOLDER' : 'CHOOSE FOLDER', picker: true, run: () => runImport(async () => {
    const fl = await pickFiles({ directory: true }) || await pickFiles({});
    return fl && fl.length ? (await backend()).collectFromFileList(fl) : null;
  }) });
  items.push({ key: 'W', label: 'WHERE DO I GET IT?', run: () => show(screenWhere()) });
  if (flow && flow.context === 'settings') items.push({ key: 'B', label: 'BACK', run: () => openSettings() });
  const notice = flow && flow.notice;
  return {
    // cab: PER-12 — a title longer than the 36-column line ('Curse of the Azure Bonds - game files') drops the suffix
    id: 'BY-1', title: `${GI().title} - game files`.length <= WIDTH ? `${GI().title} - game files` : GI().title, drop: true,
    body: [
      `This reproduction needs your own copy of ${GI().title}: the game folder with START.EXE and the .DAX files.`,
      '',
      { text: 'Nothing is uploaded. The files are checked and kept in this browser only.', colour: C.dim },
      ...(notice ? ['', { text: notice, colour: C.bad }] : []),
      '',
      { text: 'Choose the folder, or drop it on this screen.', colour: C.dim },
    ],
    items,
    back: flow && flow.context === 'settings' ? () => openSettings() : null,
  };
}

function screenWhere() {
  return {
    id: 'BY-1-WHERE', title: 'Where do I get the game files?',
    body: [
      `Use a copy of ${GI().title} for DOS that you own: your original disks or a store or archive re-release.`,
      '',
      `Copy the whole game folder to this PC: START.EXE, ITEMS and the ${GI().daxCount} .DAX files${GI().prefix === 'por' ? ' (GAME.OVR may be there too)' : ' and GAME.OVR'}.`,
      '',
      { text: `This reproduction is built on version ${GI().version} (${GI().credits}). Other versions are refused.`, colour: C.dim },
      '',
      { text: 'This page has no download links.', colour: C.dim },
    ],
    items: [{ key: 'B', label: 'BACK', run: () => show(screenImport()) }],
    back: () => show(screenImport()),
  };
}

function screenChecking(done, total, name, cancel) {
  return {
    id: 'BY-2', title: 'Checking game files',
    body: ['', '', '', { text: `${done} / ${total} FILES`, colour: C.text }, { text: name || '', colour: C.dim }],
    progress: { done, total, row: 4 },
    items: [{ key: 'C', label: 'CANCEL', run: cancel }],
    back: cancel, cancel,
  };
}

async function runImport(collect) {
  const b = await backend();
  ui.busy = true; draw();
  let cands;
  try { cands = await collect(); } finally { ui.busy = false; }
  if (!cands) { draw(); return; }                            // picker closed
  if (!cands.length) { say('NO FILES FOUND THERE'); return; }
  const ac = new AbortController();
  const cancel = () => ac.abort();
  let last = 0;
  show(screenChecking(0, 116, '', cancel));
  let report;
  try {
    report = await b.validate(cands, {
      signal: ac.signal,
      onProgress: (n, total, name) => {
        const now = performance.now();
        if (n === total || now - last > 30) { last = now; ui.screen = screenChecking(n, total, name, cancel); draw(); }
      },
    });
  } catch (e) {
    if (ac.signal.aborted) { show(screenImport()); say('CHECK CANCELLED'); return; }
    throw e;
  }
  if (typeof window !== 'undefined') window.__byocReport = { ...report, bytes: undefined };   // headless checks
  if (!report.ok) { show(screenFailed(report, cands)); return; }
  let stored = null, storeError = null;
  try { stored = await b.importFiles(report); } catch (e) { storeError = e; }
  if (storeError) { show(screenStoreFailed(report, storeError)); return; }
  const saves = await b.importSaves(report).catch(() => null);
  show(screenOk(report, saves, { session: false, persisted: stored && stored.persisted }));
}

function savesLine(report, saves) {
  const found = (report.saves || []).length;
  if (!found) return null;
  const parts = [`${saves ? saves.imported.length : 0} imported`];
  if (saves && saves.conflicts.length) parts.push(`${saves.conflicts.length} kept: a save of that name is already in this browser`);
  if (saves && saves.skipped.length) parts.push(`${saves.skipped.length} skipped: wrong size`);
  return `Saves found: ${found} (${parts.join(', ')}).`;
}

function screenOk(report, saves, { session }) {
  const items = [{ key: 'S', label: flow && flow.context === 'settings' ? 'START (RELOADS THE GAME)' : 'START', run: () => finish() }];
  if (saves && saves.conflicts.length) items.push({ key: 'R', label: `REPLACE ${saves.conflicts.length} SAVE${saves.conflicts.length > 1 ? 'S' : ''} WITH THE FOLDER'S`, run: async () => {
    const b = await backend();
    const conf = new Set(saves.conflicts);
    const r = await b.importSaves({ saves: report.saves.filter((s) => conf.has(s.name)) }, { replace: true });
    const merged = { imported: [...saves.imported, ...r.imported], conflicts: [], skipped: saves.skipped };
    show(screenOk(report, merged, { session }));
    say(`${r.imported.length} SAVE${r.imported.length === 1 ? '' : 'S'} REPLACED`);
  } });
  const sl = savesLine(report, saves);
  const ver = (report.manifestId || `${GI().prefix}-${GI().version}`).replace(/^[a-z]+-/, '');
  return {
    id: 'BY-3', title: 'Game files OK',
    body: [
      { text: `Version ${ver} recognised - ${report.okCount} files.`, colour: C.good },
      ...(sl ? ['', sl] : []),
      ...(session ? ['', { text: 'Kept for this session only: the browser cannot store them, so import the folder again next time.', colour: C.bad }] : []),
    ],
    items, prompt: 'CHOOSE A FUNCTION',
  };
}

const fmt = (n) => (n < 0 || n == null ? '?' : String(n));
function problem(f) {
  if (f.status === 'missing') return { text: 'MISSING', colour: C.bad };
  if (f.status === 'size') return { text: `SIZE ${fmt(f.size)}, NEED ${fmt(f.expectedSize)}`, colour: C.bad };
  return { text: 'DIFFERENT CONTENT', colour: C.bad };
}
export function classify(report, cands) {
  const req = report.files.filter((f) => f.required);
  const present = req.filter((f) => f.status !== 'missing').length;
  if (present === 0 && cands.some((c) => /\.ZIP$/i.test(c.name))) return 'zip';
  if (present === 0 || (present < 10 && !req.some((f) => f.name === 'START.EXE' && f.status !== 'missing'))) return 'nofolder';
  if (report.likelyOtherVersion) return 'other';
  return 'damaged';
}

function screenFailed(report, cands) {
  const kind = classify(report, cands);
  const bad = report.files.filter((f) => f.required && f.status !== 'ok');
  const n = report.requiredCount;
  const head = {
    zip: 'This is a ZIP archive. Please unpack it first, then choose the unpacked folder.',
    nofolder: `This folder does not contain ${GI().title} (START.EXE and ${GI().daxCount} .DAX files). ${cands.length} file${cands.length === 1 ? '' : 's'} looked at.`,
    other: `This looks like a different version of ${GI().title} (${bad.length} of ${n} files differ). This reproduction supports version ${GI().version} only.`,
    damaged: `${bad.length} of ${n} game files are missing or damaged. Copy the whole game folder again, then retry.`,
  }[kind];
  const showList = kind === 'other' || kind === 'damaged';
  const items = [
    { key: 'T', label: 'TRY ANOTHER FOLDER', run: () => show(screenImport()) },
    { key: 'C', label: 'COPY REPORT', run: () => copyReport(report, kind) },
  ];
  if (flow && flow.context === 'settings') items.push({ key: 'B', label: 'BACK', run: () => openSettings() });
  return {
    id: 'BY-4', title: 'Game files not accepted',
    body: [{ text: head, colour: C.text }],
    list: showList ? { head: 'FILE         PROBLEM', rows: Math.max(3, 15 - wrap(head, WIDTH).length - items.length), lines: bad.map((f) => {
      const p = problem(f); return { text: f.name.padEnd(13) + p.text, colour: p.colour };
    }) } : null,
    items, back: () => show(screenImport()), prompt: showList && bad.length > 6 ? 'PGDN, WHEEL OR RB: MORE OF THE LIST' : 'CHOOSE A FUNCTION',
  };
}

function screenStoreFailed(report, err) {
  const items = [{ key: 'T', label: 'TRY AGAIN', run: () => show(screenImport()) }];
  if (B.useSession) items.unshift({ key: 'P', label: 'PLAY THIS SESSION ONLY', run: async () => {
    await B.useSession(report);
    const saves = await B.importSaves(report).catch(() => null);
    show(screenOk(report, saves, { session: true }));
  } });
  return {
    id: 'BY-4', title: 'Game files cannot be stored',
    body: [
      { text: `Your files are fine (version ${GI().version}), but this browser does not allow storing them here (private window, blocked site data or no space).`, colour: C.text },
      '',
      { text: String((err && err.message) || err).slice(0, 108), colour: C.dim },
    ],
    items, back: () => show(screenImport()),
  };
}

export function reportText(report, kind) {
  const lines = [
    `${GI().title} (browser reproduction) - game file check`,
    `manifest: ${report.manifestId}   date: ${new Date().toISOString()}`,
    `browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : '?'}`,
    `result: ${kind}; required files ok: ${report.okCount} / ${report.requiredCount}; other version suspected: ${report.likelyOtherVersion ? 'yes' : 'no'}; GAME.OVR: ${report.gameOvr}`,
    '', 'file\tproblem\tsize\texpected\tsha256',
  ];
  for (const f of report.files) if (f.status !== 'ok' && (f.required || f.status !== 'missing'))
    lines.push([f.name, f.status, f.size ?? '', f.expectedSize ?? '', f.sha256 ?? ''].join('\t'));
  return lines.join('\n') + '\n';
}
async function copyReport(report, kind) {
  const t = reportText(report, kind);
  try { await navigator.clipboard.writeText(t); say('REPORT COPIED TO THE CLIPBOARD'); }
  catch { download(`${GI().prefix}-file-check.txt`, new Blob([t], { type: 'text/plain' })); say(`REPORT SAVED AS ${GI().prefix.toUpperCase()}-FILE-CHECK.TXT`); }
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function finish() {
  if (flow && flow.context === 'settings') { location.reload(); return; }
  hide();
  const f = flow; flow = null;
  if (f) f.done();
}

// BY-6: the in-browser test party (por-accept, game/areas/testparty.js installTestParty(); it reads the running game's
// DS image and ITEM3.DAX, so it is offered on BY-5 only, i.e. once the game has started)
let testParty;
async function loadTestParty() {
  if (testParty === undefined) {
    try { const m = await import('../../areas/testparty.js'); testParty = typeof m.installTestParty === 'function' ? () => m.installTestParty({ slot: 'C' }) : null; }
    catch { testParty = null; }
  }
  return testParty;
}
function addTestPartyItem(items) {
  if (!testParty) return;
  items.push({ key: 'T', label: 'TEST PARTY TO SLOT C', run: async () => {
    ui.busy = true; draw();
    try { await testParty(); } finally { ui.busy = false; }
    say('TEST PARTY IN SLOT C: PARTY MENU L, THEN C');
  } });
}

// ---- boot gate ------------------------------------------------------------------------------------------------------
export async function ensureGameFiles(mod) {
  const b = await backend(mod);
  let notice = null;
  try {
    if (await b.isImported()) return;
    if (await b.info()) notice = 'The game files were removed by the browser (storage was cleared). Please import them again; your saves are kept separately.';
  } catch (e) {
    notice = 'This browser does not allow storing files here (private window or blocked site data). You can still play this session.';
  }
  return new Promise((done) => {
    flow = { done, context: 'boot', notice };
    show(screenImport());
    const src = q.get('byocsrc');
    if (src) runImport(async () => b.collectFromUrl(src)).catch((e) => say('ERROR: ' + e.message));
    else if (q.get('byocmock') && q.get('byocauto')) runImport(async () => b.mockCandidates()).catch((e) => say('ERROR: ' + e.message));
  });
}

// ---- BY-5 settings --------------------------------------------------------------------------------------------------
let settingsHook = null, inGame = false, padGate = null;

export async function mountSettings(mod) {
  if (document.getElementById('byoc-gear')) return;
  await backend(mod);
  await loadTestParty();
  inGame = true;
  try { padGate = (await import('../../engine/input.js')).gamepad; } catch { padGate = null; }
  const btn = document.createElement('button');
  btn.id = 'byoc-gear';
  btn.title = 'Settings: game files';
  btn.setAttribute('aria-label', 'Settings: game files');
  btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:30;width:40px;height:40px;padding:4px;border:0;'
    + 'background:transparent;opacity:.45;cursor:pointer;';
  btn.innerHTML = GEAR_SVG;
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '.45'; });
  btn.addEventListener('click', () => { btn.blur(); toggleSettings(); });
  document.body.appendChild(btn);
  settingsHook = toggleSettings;
  startPad();
  if (q.get('screen') === 'BY-5') openSettings();
}
// a 16x16 pixel gear in the frame's yellow
const GEAR_SVG = (() => {
  const rows = ['......XXXX......', '......XXXX......', '..XX..XXXX..XX..', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...',
    '...XXXX..XXXX...', 'XXXXXX....XXXXXX', 'XXXXX......XXXXX', 'XXXXX......XXXXX', 'XXXXXX....XXXXXX',
    '...XXXX..XXXX...', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '..XX..XXXX..XX..', '......XXXX......', '......XXXX......'];
  let r = '';
  rows.forEach((s, y) => [...s].forEach((c, x) => { if (c === 'X') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }));
  return `<svg viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" fill="#ffff55">${r}</svg>`;
})();

function toggleSettings() {
  if (ui.screen && ui.root.style.display !== 'none') { if (!ui.busy && flow && flow.context === 'settings') closeSettings(); }
  else if (inGame) openSettings();
}
function closeSettings() {
  flow = null; hide();
  if (padGate) padGate.suspended = false;
}

export async function openSettings() {
  const b = await backend();
  flow = { context: 'settings', done: closeSettings };
  if (padGate) padGate.suspended = true;
  const m = await b.info().catch(() => null);
  let usage = null, persisted = null;
  try { usage = (await navigator.storage.estimate()).usage; persisted = await navigator.storage.persisted(); } catch { /* */ }
  const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
  const when = m && m.importedAt ? m.importedAt.replace('T', ' ').slice(0, 16) : '-';
  const ovr = { match: 'checked (not needed)', absent: 'not found (not needed)', mismatch: 'differs (not needed)' }[m && m.gameOvr] || '-';
  const row = (k, v, c = C.text) => ({ label: k, text: v, indent: 11, colour: c });
  const body = m ? [
    row('VERSION', `${(m.manifest || '').replace(/^[a-z]+-/, '')} (manifest ${m.manifest})${m.variant ? ' ' + m.variant : ''}`),
    row('IMPORTED', when + ' UTC'),
    row('FILES', `${m.count}, ${mb(m.bytes || 0)}`),
    ...(usage != null ? [row('STORAGE', `${mb(usage)} used by this site`)] : []),
    ...(persisted != null ? [row('', persisted ? 'kept permanently' : 'may be cleared if space runs low', persisted ? C.dim : C.bad)] : []),
    row('GAME.OVR', ovr, C.dim),
  ] : [{ text: 'Game files are kept for this session only (not stored in this browser).', colour: C.bad }];
  const items = [
    { key: 'R', label: 'RE-IMPORT GAME FILES', run: () => { flow = { context: 'settings', done: closeSettings }; show(screenImport()); } },
    { key: 'D', label: 'DELETE GAME FILES', disabled: !m, run: () => show(screenConfirmDelete(), 'N') },
    { key: 'E', label: 'EXPORT SAVES', run: exportSaves },
    { key: 'I', label: 'IMPORT SAVES', picker: true, run: importSavesFlow },
  ];
  addTestPartyItem(items);
  items.push({ key: 'B', label: 'BACK TO THE GAME', run: closeSettings });
  show({ id: 'BY-5', title: 'Settings - game files', body, items, back: closeSettings, prompt: 'CHOOSE A FUNCTION' });
}

function screenConfirmDelete() {
  return {
    id: 'BY-5-DELETE', title: 'Delete game files?',
    body: [
      'Delete the game files from this browser?',
      '',
      { text: 'Your saves stay. To play again you import the game folder once more.', colour: C.dim },
    ],
    items: [
      { key: 'N', label: 'NO, KEEP THEM', run: () => openSettings() },
      { key: 'Y', label: 'YES, DELETE', run: async () => { await (await backend()).removeGameFiles(); location.reload(); } },
    ],
    back: () => openSettings(),
  };
}

async function exportSaves() {
  let list = null;
  try {
    const F = q.get('byocmock') ? B : await import('../../engine/files.js');
    if (F.listStore) list = await F.listStore();
  } catch { list = null; }
  if (!list) { say('EXPORT NEEDS AN ENGINE UPDATE (BYOC API #1)'); return; }
  if (!list.length) { say('NO SAVES IN THIS BROWSER YET'); return; }
  const { exportNotes } = await import('../../plus/notes/export.js');
  await globalThis.goldBoxPlusTabs?.journal?.tracker?.flush();
  list.push(...await exportNotes({ profile: GI().prefix }));
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  download(`${GI().prefix}-saves-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.zip`, new Blob([makeZip(list)], { type: 'application/zip' }));
  say(`${list.length} SAVE FILE${list.length === 1 ? '' : 'S'} EXPORTED`);
}

async function importSavesFlow() {
  const fl = await pickFiles({ accept: '.zip,.dat,.sav,.itm,.spc,.cha,.txt' });
  if (!fl || !fl.length) return;
  ui.busy = true; draw();
  const cands = [];
  try {
    for (const f of Array.from(fl)) {
      if (/\.zip$/i.test(f.name)) {
        for (const e of await readZip(new Uint8Array(await f.arrayBuffer()))) savesCand(cands, e.name, e.bytes.length, async () => e.bytes);
      } else savesCand(cands, f.name, f.size, async () => new Uint8Array(await f.arrayBuffer()));
    }
  } finally { ui.busy = false; }
  const b = await backend();
  const saves = b.checkSaves ? await b.checkSaves(cands) : (await b.validate(cands)).saves;
  const r = await b.importSaves({ saves });
  show(screenSavesResult(saves, r));
}
function savesCand(out, path, size, read) {
  const name = path.split(/[\\/]/).pop().toUpperCase();
  out.push({ path, name, dir: 'SAVE', size, read });
}
function screenSavesResult(saves, r) {
  const items = [];
  if (r.conflicts.length) items.push({ key: 'R', label: `REPLACE ${r.conflicts.length} WITH THE IMPORTED`, run: async () => {
    const conf = new Set(r.conflicts);
    const r2 = await (await backend()).importSaves({ saves: saves.filter((s) => conf.has(s.name)) }, { replace: true });
    show(screenSavesResult(saves, { imported: [...r.imported, ...r2.imported], conflicts: [], skipped: r.skipped }));
  } });
  items.push({ key: 'B', label: 'BACK', run: () => openSettings() });
  const lines = [
    ...r.imported.map((n) => ({ text: n.padEnd(13) + 'IMPORTED', colour: C.good })),
    ...r.conflicts.map((n) => ({ text: n.padEnd(13) + 'KEPT YOURS', colour: C.title })),
    ...r.skipped.map((n) => ({ text: n.padEnd(13) + 'SKIPPED: WRONG SIZE', colour: C.bad })),
  ];
  return {
    id: 'BY-5-SAVES', title: 'Import saves',
    body: [`${r.imported.length} imported, ${r.conflicts.length} already in this browser, ${r.skipped.length} skipped.`],
    list: lines.length ? { head: 'FILE         RESULT', rows: 10, lines } : null,
    items, back: () => openSettings(),
    prompt: r.imported.length ? 'LOAD THEM FROM THE PARTY MENU (L)' : 'CHOOSE A FUNCTION',
  };
}
