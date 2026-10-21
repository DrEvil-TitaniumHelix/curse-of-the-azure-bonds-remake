// tabs-shot.mjs (cab-plus-shell; the owner 2026-10-21 spot checks: one headless shot per Plus tab, the logic is proven by the
// node tests). One page in the start room of a new game (acceptance/areas_shots.sh B route: ALPHA, Begin = REF-S049),
// Plus mounted by the boot (main_cab.js, plus request #5); per tab: open F12, select the tab, wait for its content, a page
// screenshot (acceptance/local/plus/tab-<id>.png, gitignored: the frame shows original art) and a light content check.
// Then the closed panel with the F12 hint strip, the dev-only tabs (?dev=1, Cheats + Scenario in one shot), and the frame
// proof: a 640x400 window (the frame fills it unless fit() leaves the strip, plus request #6) with the strip's rectangle
// measured against the canvas and the canvas pixels unchanged by Plus. Report: acceptance/reports/plus/PLUS-TABS.json.
// Shared run lock (PoolRadianceRE/acceptance/runlock.mjs), own `tools/serve.py 8191 --dev`.   Usage: node game/test/plus/tabs-shot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../../PoolRadianceRE/acceptance/runlock.mjs';
import { ROOT, local, report, sha256 } from '../../../acceptance/paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTTP = 8191, PORT = 9600 + (process.pid % 300), BASE = `http://127.0.0.1:${HTTP}/index.html`;
const START = 'screen=idle&fast=4&seed=169084438&wheel=1&freshsaves=1&keys={Space}{Space}{Space}{Space}Pa{Enter}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = local('plus');
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;   // e.g. ONLY=pedia: rerun one shot
const want = (id) => !ONLY || ONLY.has(id);

await acquireLock('cab-plus-shell tabs-shot.mjs');
const server = spawn('python', ['-I', 'tools/serve.py', String(HTTP), '--dev'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `cab-plus-tabs-${process.pid}`)}`,
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-plus-tabs-${process.pid}`);
onRelease(() => { chrome.kill(); server.kill(); });

async function getJSON(path, method = 'GET') {
  for (let i = 0; i < 150; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json(); } catch { await sleep(200); } }
  throw new Error('chrome did not start');
}
function connect(url) {
  const ws = new WebSocket(url); let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 30000); pending.set(i, (m) => { clearTimeout(t); r(m); }); ws.send(JSON.stringify({ id: i, method, params })); });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, close: () => ws.close() }); });
}
const evaluate = async (s, expression) => {
  const r = await s.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
async function open(width, height, query) {
  const tab = await getJSON('/json/new?about:blank', 'PUT'), s = await connect(tab.webSocketDebuggerUrl);
  await s.send('Runtime.enable'); await s.send('Page.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await s.send('Page.navigate', { url: `${BASE}?${query}` });
  const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 90000) { if (await evaluate(s, 'window.__screenReady === true && !!window.goldBoxPlus').catch(() => false)) { ready = true; break; } await sleep(250); }
  await sleep(500);
  return { s, tab, ready };
}
const results = [];
async function shot(s, id, check, extra = {}) {
  const png = Buffer.from((await s.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  writeFileSync(join(OUT, `tab-${id}.png`), png);
  const errors = s.errors.splice(0);
  const pass = !!check?.ok && !errors.length;
  results.push({ id, verdict: pass ? 'PASS' : 'FAIL', check, errors, file: `acceptance/local/plus/tab-${id}.png`, sha256: sha256(png), ...extra });
  console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(check).slice(0, 240)}${errors.length ? ' errors: ' + errors.join(' | ').slice(0, 300) : ''}`);
}
// open the panel on a tab and wait until `ready(text)` holds for its content (or 15 s)
const TAB = (id, ready) => `(async () => {
  const p = window.goldBoxPlus; p.open(); p.selectTab(${JSON.stringify(id)});
  const body = () => document.getElementById('por-plus-content');
  let text = '';
  for (let i = 0; i < 150; i++) { text = body().textContent; if ((${ready})(text, body())) break; await new Promise((r) => setTimeout(r, 100)); }
  const canvas = body().querySelector('canvas[role=img]');   // map: the whole 16x16 map in view (zoom 50 %, scrolled to it)
  if (${JSON.stringify(id)} === 'map' && canvas) { const z = body().querySelector('input[type=range]'); z.value = '.5'; z.dispatchEvent(new Event('input')); canvas.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 200)); }
  const selected = document.querySelector('#por-plus [aria-selected=true]')?.dataset.tab;
  return { ok: selected === ${JSON.stringify(id)} && (${ready})(text, body()), selected, text: text.slice(0, 160) };
})()`;
const FRAME = `(() => {
  const c = document.getElementById('screen').getBoundingClientRect(), hint = document.getElementById('cab-plus-hint'), h = hint.getBoundingClientRect(), cs = getComputedStyle(hint);
  const shown = !hint.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && h.width > 0, overlap = h.left < c.right && h.right > c.left && h.top < c.bottom && h.bottom > c.top;
  return { ok: shown && !overlap && cs.position === 'fixed' && h.top >= c.bottom && h.bottom <= innerHeight && /F12 opens the Plus screen/.test(hint.textContent),
    where: hint.dataset.where, position: cs.position, hint: [h.left, h.top, h.width, h.height].map(Math.round), frame: [c.left, c.top, c.width, c.height].map(Math.round), viewport: [innerWidth, innerHeight] };
})()`;

try {
  // 1. the start room: every player tab, then the hint strip with the panel closed
  {
    const { s, tab, ready } = await open(1000, 700, START);
    const before = await evaluate(s, "document.getElementById('screen').toDataURL()");
    const tabs = [
      ['status', '(t) => /ECL2\\/1: 3D map \\d+, square \\(7, 13\\), facing East/.test(t) && /ALPHA/.test(t)'],
      ['keys', '(t) => /F12 \\/ gamepad Menu/.test(t) && /Encamp/i.test(t)'],
      ['about', '(t) => /coab/.test(t) && /Gold Box Companion/.test(t) && /Pool of Radiance/.test(t)'],
      ['journal', '(t, b) => /Journal entries the game has cited/.test(t) && !!b.querySelector("#cab-plus-cited")'],
      ['map', '(t, b) => !!b.querySelector("canvas") && /3D map \\d+, 16 × 16/.test(t) && /[1-9]\\d* cells visited/.test(t)'],
      ['pedia', '(t) => /Pedia/i.test(t) && !/Reading your imported game files|unavailable|failed/i.test(t) && t.length > 200'],   // the catalogue built, not still loading
      ['quests', '(t) => /Quests?/i.test(t) && !/unavailable|failed/i.test(t)'],
    ];
    for (const [id, ready2] of tabs) if (want(id)) await shot(s, id, ready ? await evaluate(s, TAB(id, ready2)).catch((e) => ({ ok: false, error: e.message })) : { ok: false, error: 'page not ready' });
    // notes: the diary (inside the Journal tab) with one personal note added through the tracker
    if (want('notes')) { const notes = ready ? await evaluate(s, `(async () => { await window.goldBoxPlusTabs.journal.tracker.addNote('Synthetic note: spot check'); await window.goldBoxPlusTabs.journal.tracker.flush(); return 1; })()`)
      .then(() => evaluate(s, TAB('journal', '(t) => /Synthetic note: spot check/.test(t) && /Diary/.test(t)'))).catch((e) => ({ ok: false, error: e.message })) : { ok: false };
    await shot(s, 'notes', notes); }
    await evaluate(s, 'window.goldBoxPlus.close()'); await sleep(300);
    const hint = await evaluate(s, FRAME); hint.canvasUnchanged = before === await evaluate(s, "document.getElementById('screen').toDataURL()");
    hint.ok = hint.ok && hint.canvasUnchanged;
    if (want('hint')) await shot(s, 'hint', hint);
    s.close(); await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
  // 2. dev-only: Cheats and Scenario (?dev=1), one shot
  if (want('dev')) {
    const { s, tab, ready } = await open(1000, 700, 'screen=S015&fast=4&dev=1');
    const dev = ready ? await evaluate(s, TAB('cheats', '(t) => /Cheats \\(developer tools\\)/.test(t)')).catch((e) => ({ ok: false, error: e.message })) : { ok: false };
    const visible = ready ? await evaluate(s, "[...document.querySelectorAll('#por-plus [role=tab]')].filter((b) => !b.hidden).map((b) => b.dataset.tab)") : [];
    dev.ok = dev.ok && visible.includes('cheats') && visible.includes('scenario'); dev.visible = visible;
    await shot(s, 'dev', dev);
    s.close(); await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
  // 3. the frame proof: 640x400, the window the frame would fill
  if (want('frame')) {
    const { s, tab, ready } = await open(640, 400, 'screen=S015&fast=4');
    const before = ready ? await evaluate(s, "document.getElementById('screen').toDataURL()") : null;
    const frame = ready ? await evaluate(s, FRAME) : { ok: false };
    if (ready) { frame.canvasUnchanged = before === await evaluate(s, "document.getElementById('screen').toDataURL()"); frame.ok = frame.ok && frame.canvasUnchanged; }
    await shot(s, 'frame', frame);
    s.close(); await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
} finally { chrome.kill(); server.kill(); releaseLock(); }
writeFileSync(report('plus', ONLY ? `PLUS-TABS-${[...ONLY].join('-')}` : 'PLUS-TABS'), JSON.stringify({ id: 'PLUS-TABS', utc: new Date().toISOString(), results }, null, 1) + '\n');
const failed = results.filter((r) => r.verdict !== 'PASS').length;
console.log(`${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
