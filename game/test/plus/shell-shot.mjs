// shell-shot.mjs (cab-plus-shell, S2) — headless Chrome check of the Plus shell over the running game, at three
// viewport sizes: the F12 hint strip is present and readable OUTSIDE the scaled 320x200 frame, the game canvas does
// not change when Plus mounts / opens / closes, F12 opens and Esc closes the panel, and "Play the original game" hides
// the hint (and only that does). Page screenshots go to acceptance/local/plus/<case>.png (gitignored: the frame shows
// original art); the report with their SHA-256 is acceptance/reports/plus/PLUS-SHELL.json.
// Takes the shared run lock (PoolRadianceRE/acceptance/runlock.mjs). Starts its own `tools/serve.py <port> --dev`
// unless GAME_URL is given.   Usage: node game/test/plus/shell-shot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../../PoolRadianceRE/acceptance/runlock.mjs';
import { ROOT, local, report, sha256 } from '../../../acceptance/paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTTP = 8191, PORT = 9600 + (process.pid % 300);
const BASE = process.env.GAME_URL || `http://127.0.0.1:${HTTP}/index.html`;
const ROUTE = process.env.ROUTE || 'screen=S015&fast=4';   // titles + the Play Demo prompt (REF-S015)
const START = 'seed=169084438&wheel=1&freshsaves=1&keys={Space}{Space}{Space}{Space}Pa{Enter}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const CASES = [
  { id: 'desktop', width: 1000, height: 700 },   // scale 3, 50 px strips above / below
  { id: 'phone', width: 360, height: 640, mobile: true },   // scale 1, the frame in the middle of a tall screen
  { id: 'exact', width: 640, height: 400 },      // scale 2 fills the window: no margin unless fit() leaves the strip
  { id: 'journal', width: 1000, height: 700, journal: true },   // S4: the Journal tab after two synthetic citations
  // S6: the camp run's new game (acceptance/areas_shots.sh B: ALPHA, Begin) = the start room of ECL2/1 (REF-S049)
  { id: 'map', width: 1000, height: 700, route: 'screen=idle&fast=4&' + START, map: true },
  { id: 'helpers', width: 1000, height: 700, route: 'screen=idle&fast=4&' + START, helpers: true },
  { id: 'dev', width: 1000, height: 700, route: 'screen=S015&fast=4&dev=1', dev: true },   // S7: the dev-only tabs appear with ?dev=1
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = local('plus');

await acquireLock('cab-plus-shell shell-shot.mjs');
const server = process.env.GAME_URL ? null
  : spawn('python', ['-I', 'tools/serve.py', String(HTTP), '--dev'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `cab-plus-shot-${process.pid}`)}`, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-plus-shot-${process.pid}`);
onRelease(() => { chrome.kill(); server?.kill(); });

async function getJSON(path, method = 'GET') {
  for (let i = 0; i < 150; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json(); } catch { await sleep(200); }
  }
  throw new Error('chrome did not start');
}
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 20000);
    pending.set(i, (m) => { clearTimeout(t); r(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, close: () => ws.close() }); });
}
const evaluate = async (s, expression) => {
  const r = await s.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

// in the page: mount Plus the way the boot will (plus request #5), then measure and drive it
const PROBE = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.getElementById('screen'), pix = () => canvas.toDataURL();
  const E = window.E; if (E) E.pic.display.present();
  const before = pix();
  const { mountPlus } = await import('/plus/plus.js'); const p = mountPlus(); await p.ready; await frames();
  const hint = document.getElementById('cab-plus-hint');
  const measure = () => { const c = canvas.getBoundingClientRect(), h = hint.getBoundingClientRect(), cs = getComputedStyle(hint);
    const shown = !hint.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && h.width > 0 && h.height > 0;
    const overlap = shown && h.left < c.right && h.right > c.left && h.top < c.bottom && h.bottom > c.top;
    return { where: hint.dataset.where || null, shown, overlap, text: hint.textContent, reserve: document.documentElement.dataset.plusHint || null,
      hint: [h.left, h.top, h.width, h.height].map(Math.round), frame: [c.left, c.top, c.width, c.height].map(Math.round),
      inViewport: h.left >= 0 && h.top >= 0 && h.right <= innerWidth && h.bottom <= innerHeight }; };
  const mounted = measure();
  const press = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  press('F12'); await frames(); const opened = p.isOpen && !document.getElementById('por-plus').hidden;
  const tabs = [...document.querySelectorAll('#por-plus [role=tab]')].filter((b) => !b.hidden).map((b) => b.dataset.tab);   // dev-only tabs are hidden in player mode
  p.selectTab('about'); const about = document.getElementById('por-plus-content').textContent;
  p.selectTab('games'); for (let i = 0; i < 50 && !document.querySelector('#por-plus-content [data-game=por]'); i++) await new Promise((r) => setTimeout(r, 100));
  const games = [...document.querySelectorAll('#por-plus-content [data-game]')].map((r) => r.dataset.game + (r.querySelector('button').disabled ? '-' : '+'));
  press('Escape'); await frames(); const closed = !p.isOpen;
  await p.setSetting('original', true); await frames(); const original = measure();
  await p.setSetting('original', false); await frames(); const back = measure();
  if (E) E.pic.display.present();
  return { mounted, opened, closed, tabs, credits: ['coab', 'Gold Box Companion', 'Pool of Radiance'].filter((w) => about.includes(w)),
    games, original, back, canvasUnchanged: before === pix() };
})()`;

// S4 (in the page, after PROBE): synthetic citations through the real hooks.js (journalRef from textPrinted, incl. the Curse
// split form), the player's own text imported for one cited and one uncited entry; the panel stays open on the Journal.
const JOURNAL = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { hooks } = await import('/plus/hooks.js'); const was = hooks.enabled; hooks.enabled = true;   // until plus request #5 mounts Plus
  const reg = window.goldBoxPlusTabs?.journal; if (!reg) throw Error('journal tab not registered');
  hooks.emit('textPrinted', { text: 'SYNTHETIC SCENE ONE', clear: true }); hooks.emit('textPrinted', { text: 'SYNTHETIC: RECORD IT IN JOURNAL ENTRY 41.' });
  hooks.emit('textPrinted', { text: 'SYNTHETIC SCENE TWO', clear: true }); hooks.emit('textPrinted', { text: 'SYNTHETIC: LOG IT AS JOURNAL ' }); hooks.emit('textPrinted', { text: 'ENTRY 4.' });
  await reg.tracker.importEntries({ 'entry:4': 'Synthetic player text for entry 4.', 'entry:9': 'Synthetic text never cited.' }); await reg.tracker.flush();
  hooks.enabled = was;
  const p = window.goldBoxPlus; p.open(); p.selectTab('journal'); await frames();
  const cited = [...document.querySelectorAll('#cab-plus-cited [data-entry]')].map((a) => a.dataset.entry);
  const page = document.getElementById('por-plus-content').textContent;
  return { cited, ownText: page.includes('Synthetic player text for entry 4.'), uncitedHidden: !page.includes('Synthetic text never cited.') && !cited.includes('entry:9'),
    line: page.includes('SYNTHETIC: RECORD IT IN JOURNAL ENTRY 41.') };
})()`;

// S6 (in the page): the Map tab over the start room: the player's GEO map drawn, the start cell visited, the facing marker
const MAP = `(async () => {
  const p = window.goldBoxPlus; p.open(); p.selectTab('map');
  for (let i = 0; i < 100 && !document.querySelector('#por-plus-content canvas'); i++) await new Promise((r) => setTimeout(r, 100));
  const c = document.querySelector('#por-plus-content canvas'), status = document.querySelector('#por-plus-content [role=status]')?.textContent || '';
  const progress = document.querySelector('[data-map-progress]')?.textContent || '';
  const map = { drawn: !!c && c.width === 385, status, progress, label: c?.getAttribute('aria-label') || '' };
  p.selectTab('status'); await new Promise((r) => setTimeout(r, 100));   // step 4: the Status tab from hooks.state
  const place = document.querySelector('#por-plus-content [data-status=place]')?.textContent || '', rows = document.querySelectorAll('#por-plus-content [data-status=party] tr').length - 1;
  p.selectTab('map'); await new Promise((r) => setTimeout(r, 300));
  return { ...map, statusPlace: place, statusRows: rows };
})()`;
// S6: helper toggles: each overlay appears only while its toggle is on; the game canvas never changes
const HELPERS = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.getElementById('screen'), pix = () => canvas.toDataURL(), p = window.goldBoxPlus;
  for (let i = 0; i < 50 && !window.goldBoxPlusHelpers; i++) await new Promise((r) => setTimeout(r, 100));
  const ids = ['por-plus-crisp', 'por-plus-combatlog'], present = () => ids.filter((id) => document.getElementById(id));
  const before = pix(), off = present();
  await p.setSetting('crispFont', true); await p.setSetting('combatLog', true); await p.setSetting('tooltips', true); await frames(); await new Promise((r) => setTimeout(r, 300));
  const on = present(), cells = Number(document.getElementById('por-plus-crisp')?.dataset.cells || 0), during = pix();
  await p.setSetting('crispFont', false); await p.setSetting('combatLog', false); await p.setSetting('tooltips', false); await frames();
  return { started: !!window.goldBoxPlusHelpers, off, on, cells, after: present(), canvasUnchanged: before === during && before === pix() };
})()`;

const results = [];
let failed = 0;
try {
  for (const c of CASES) {
    if (ONLY && !ONLY.has(c.id)) continue;
    const tab = await getJSON('/json/new?about:blank', 'PUT');
    const s = await connect(tab.webSocketDebuggerUrl);
    await s.send('Runtime.enable'); await s.send('Page.enable');
    await s.send('Emulation.setDeviceMetricsOverride', { width: c.width, height: c.height, deviceScaleFactor: 1, mobile: !!c.mobile });
    await s.send('Page.navigate', { url: `${BASE}?${c.route || ROUTE}` });
    const t0 = Date.now(); let ready = false;
    while (Date.now() - t0 < (c.route ? 90000 : 30000)) { if (await evaluate(s, 'window.__screenReady === true').catch(() => false)) { ready = true; break; } await sleep(200); }
    await sleep(300);
    let probe = null, error = null;
    try { probe = await evaluate(s, PROBE); } catch (e) { error = String(e.message || e); }
    let journal = null;
    if (c.journal && probe) { try { journal = await evaluate(s, JOURNAL); await sleep(200); } catch (e) { error = String(e.message || e); } }
    let map = null, helpers = null;
    if (c.map && probe) { try { map = await evaluate(s, MAP); await sleep(300); } catch (e) { error = String(e.message || e); } }
    if (c.helpers && probe) { try { helpers = await evaluate(s, HELPERS); } catch (e) { error = String(e.message || e); } }
    const shot = await s.send('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(shot.result.data, 'base64');
    writeFileSync(join(OUT, `shell-${c.id}.png`), png);
    const m = probe?.mounted, b = probe?.back;
    const checks = probe && {
      hintOutsideFrame: m.shown && !m.overlap && m.inViewport && /F12 opens the Plus screen/.test(m.text),
      panelF12Esc: probe.opened && probe.closed,
      originalHidesHint: !probe.original.shown && probe.original.reserve === null,
      hintBack: b.shown && !b.overlap,
      canvasUnchanged: probe.canvasUnchanged,
      credits: probe.credits.length === 3,
      games: probe.games.join(',') === 'cab+,por-',
      ...(c.map ? { map: !!map && map.drawn && /3D map \d+/.test(map.status) && /^[1-9]\d* cells visited/.test(map.progress) && /Party facing/.test(map.label), status: !!map && /ECL2\/1: 3D map \d+, square \(7, 13\), facing East/.test(map.statusPlace) && map.statusRows === 1 } : {}),
      ...(c.helpers ? { helpers: !!helpers && helpers.started && helpers.off.length === 0 && helpers.on.length === 2 && helpers.cells > 0 && helpers.after.length === 0 && helpers.canvasUnchanged } : {}),
      ...(c.journal ? { journal: !!journal && journal.cited.join(',') === 'entry:4,entry:41' && journal.ownText && journal.uncitedHidden && journal.line } : {}),
      tabs: probe.tabs.join(',') === (c.dev ? 'status,quests,journal,pedia,map,helpers,keys,cheats,scenario,games,about' : 'status,quests,journal,pedia,map,helpers,keys,games,about'),
    };
    // the exact-fit window has no margin: the hint waits (hidden, never over the frame) until fit() leaves the strip
    const pendingFit = c.id === 'exact' && m && m.where === 'none' && !m.overlap;
    if (pendingFit) { checks.hintOutsideFrame = 'PENDING plus request #6'; checks.hintBack = 'PENDING plus request #6'; }
    const pass = ready && !error && !s.errors.length && checks && Object.values(checks).every((v) => v === true || String(v).startsWith('PENDING'));
    if (!pass) failed++;
    results.push({ case: c.id, viewport: [c.width, c.height], url: `${BASE}?${c.route || ROUTE}`, ready, error, errors: s.errors, checks, probe, journal, map, helpers,
      file: `acceptance/local/plus/shell-${c.id}.png`, sha256: sha256(png), verdict: pass ? 'PASS' : 'FAIL' });
    console.log(`${c.id}: ${pass ? 'PASS' : 'FAIL'} where=${m?.where} hint=${m?.hint} frame=${m?.frame}${error ? ' error: ' + error : ''}${s.errors.length ? ' errors: ' + s.errors.join(' | ') : ''}`);
    s.close();
    await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
} finally {
  chrome.kill(); server?.kill();
  releaseLock();
}
writeFileSync(report('plus', 'PLUS-SHELL'), JSON.stringify({ id: 'PLUS-SHELL', utc: new Date().toISOString(), results }, null, 1) + '\n');
console.log(failed ? `FAIL ${failed}` : 'PASS'); process.exit(failed ? 1 : 0);
