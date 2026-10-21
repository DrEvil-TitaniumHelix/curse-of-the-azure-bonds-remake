// acceptance/plus/click_run.mjs (cab-build-engine, S3 click) — W3 by real mouse events: headless Chrome, CDP
// Input.dispatchMouseEvent on the game canvas at 320x200 game points, Plus on (the default boot). Each step clicks and
// then checks what the game did through the Plus event log (?hooklog=1) and hooks.state; shots to
// acceptance/local/plus/click-<step>.png, results to acceptance/reports/plus/CLICK-RUN.json.
//   1 top menu: left click on the hot letter C of 'Choose a function' (row 24)   -> the race list waits ('Pick Race')
//   2 list: left click on the Elf row (moves the highlight), again (= Enter)      -> the gender list waits
//   3 explore (RUN-1 party): right click on the roster line of BETA, the list's 'Select BETA' -> BETA selected
//   4 explore: left click on 'Area' (bottom menu), then on the area-map cell 6,13  -> the party walks into the inn (6,13 W)
// Needs: python -I tools/serve.py 8189 --dev. Takes the shared run lock (one Chrome across projects). Foreground only.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../PoolRadianceRE/acceptance/runlock.mjs';
import { local, report, sha256 } from '../paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.GAME_URL || 'http://127.0.0.1:8189/index.html';
const OUT = local('plus');
const PORT = 9400 + (process.pid % 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const C = (() => { let s = ''; for (const n of ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSI']) s += `C{Enter}{Enter}{Enter}{Enter}N${n}{Enter}EYY`;
  return s + 'C{End}{End}{End}{End}{End}{Enter}{Enter}{End}{End}{Enter}{Enter}NZETA{Enter}EYY'; })();
const PARTY = `{Space}{Space}{Space}{Space}Pa{Enter}${C}A{Enter}A{End}A{End}A{End}A{End}A{End}A{Esc}B{Enter}{Enter}`;

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
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id; const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 20000);
    pending.set(i, (m) => { clearTimeout(t); m.error ? j(new Error(m.error.message)) : r(m.result); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, close: () => ws.close() }); });
}
const ev = async (s, expr) => (await s.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
async function until(s, expr, ms = 120000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(s, expr)) return true; await sleep(200); } return false; }
// game point (x, y) -> a mouse click on the canvas
async function clickAt(s, x, y, button = 'left') {
  const r = await ev(s, "(() => { const b = document.getElementById('screen').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; })()");
  const cx = r.l + (x + 0.5) * r.w / 320, cy = r.t + (y + 0.5) * r.h / 200;
  await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
  await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button, clickCount: 1 });
  await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button, clickCount: 1 });
}
// click the entry of the open right-click list whose label matches
async function chooseEntry(s, re) {
  const ok = await ev(s, `(() => { const b = [...document.querySelectorAll('.por-click button')].find((x) => ${re}.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
  return !!ok;
}
async function shot(s, name) {
  const data = await ev(s, "(() => { window.E && E.pic.display.present(); return document.getElementById('screen').toDataURL('image/png'); })()");
  const png = Buffer.from(data.split(',')[1], 'base64'); writeFileSync(join(OUT, `click-${name}.png`), png); return sha256(png);
}
const lastList = "(() => { const L = window.__hookLog || []; for (let i = L.length - 1; i >= 0; i--) if (L[i].event === 'listDrawn') return (L[i].items || []).map((x) => x.text.trim()); return null; })()";
const idle = "window.__screenReady === true";

await acquireLock('click_run.mjs');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `cab-click-${process.pid}`)}`,
  '--window-size=1280,800', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-click-${process.pid}`);
onRelease(() => chrome.kill());
const results = [];
const step = (id, pass, extra) => { results.push({ id, pass, ...extra }); console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(extra).slice(0, 240)}`); };
try {
  // 1 + 2: top menu and lists
  let tab = await getJSON(`/json/new?about:blank`, 'PUT'); let s = await connect(tab.webSocketDebuggerUrl);
  await s.send('Runtime.enable');
  await s.send('Page.navigate', { url: `${BASE}?screen=idle&sting=1&seed=4444&wheel=1&fast=4&freshsaves=1&hooklog=1&keys=Pa{Enter}` });
  await until(s, idle);
  await clickAt(s, 18 * 8 + 3, 196);                                  // 'C' after 'Choose a function '
  await until(s, `(${lastList} || [])[0] === 'Pick Race'`, 20000);
  step('1-topmenu-C', (await ev(s, lastList))?.[0] === 'Pick Race', { list: await ev(s, lastList), png: await shot(s, '1') });
  const row = await ev(s, "(() => { const L = __hookLog.filter((e) => e.event === 'listDrawn').pop(); return { y1: L.rect.y1, top: L.top, items: L.items.map((x) => x.text.trim()) }; })()");
  const elf = row.items.findIndex((t) => /^Elf$/i.test(t));
  const y = row.y1 + (elf - row.top) * 8 + 3;
  await clickAt(s, 40, y); await sleep(600); await clickAt(s, 40, y);
  await until(s, `(${lastList} || [])[0] === 'Pick Gender'`, 20000);
  step('2-list-row', (await ev(s, lastList))?.[0] === 'Pick Gender', { elfRow: elf, png: await shot(s, '2') });
  s.close(); await getJSON(`/json/close/${tab.id}`).catch(() => {});

  // 3 + 4: explore with the RUN-1 party
  tab = await getJSON(`/json/new?about:blank`, 'PUT'); s = await connect(tab.webSocketDebuggerUrl);
  await s.send('Runtime.enable');
  await s.send('Page.navigate', { url: `${BASE}?screen=idle&seed=169084438&wheel=1&freshsaves=1&hooklog=1&keys=${PARTY}` });
  await until(s, idle, 300000);
  const sel = "(() => __hooks.state.party().find((m) => m.selected)?.name)()";
  await clickAt(s, 0x12 * 8 + 4, 5 * 8 + 3, 'right');                 // BETA's roster line (row 5)
  await sleep(300);
  const chose = await chooseEntry(s, '/^Select BETA/');
  await until(s, `${sel} === 'BETA'`, 20000);
  step('3-roster-select', (await ev(s, sel)) === 'BETA', { chose, png: await shot(s, '3') });
  await clickAt(s, 3, 196);                                           // 'Area' = the first word of the explore menu
  await until(s, "(() => { const L = __hookLog; for (let i = L.length - 1; i >= 0; i--) if (L[i].event === 'viewDrawn') return L[i].mode === 'areamap'; return false; })()", 20000);
  const o = await ev(s, "(() => { const L = __hookLog.filter((e) => e.event === 'viewDrawn' && e.mode === 'areamap').pop(); return L && L.origin; })()");
  await clickAt(s, 24 + (6 - o.x) * 8 + 3, 24 + (13 - o.y) * 8 + 3);  // map cell 6,13 (the inn)
  await until(s, "(() => { const p = __hooks.state.position(); return p.x === 6 && p.y === 13; })()", 30000);
  const pos = await ev(s, '__hooks.state.position()');
  step('4-areamap-walk', pos.x === 6 && pos.y === 13, { pos, png: await shot(s, '4') });
  results.push({ errors: s.errors });
  s.close();
} finally { chrome.kill(); releaseLock(); }
mkdirSync('acceptance/reports/plus', { recursive: true });
writeFileSync(report('plus', 'CLICK-RUN'), JSON.stringify({ utc: new Date().toISOString(), results }, null, 1) + '\n');
process.exit(results.every((r) => r.pass !== false) ? 0 : 1);
