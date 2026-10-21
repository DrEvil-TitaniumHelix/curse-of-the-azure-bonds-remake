// shoot.mjs (por-byoc-ui) — headless screenshots of the BYOC screens BY-1..BY-5 (game/byoc/ui). Each argument is
// <name>=<query>[|<keys>]: opens index.html?<query>, waits for window.__screenReady (byoc-ui.js sets it for ?screen=BY-n),
// optionally types <keys> (';' separated DOM key names: Down;Enter;Escape;y, or @col.row = a mouse click on that grid cell), then saves <out>/<name>.png (320x200,
// game canvas + BYOC overlay) and <out>/<name>.win.png (the whole 1280x800 window: overlay placement, gear).
// Takes the shared run lock (acceptance/runlock.mjs). Needs python -I tools/serve.py 8188.
// Usage: [GAME_URL=http://127.0.0.1:8190/index.html] [PRE=<js>] node game/test/byoc-ui/shoot.mjs <outdir> name=query[|keys] ...
// (a server without --dev shows the screens; with --dev, main.js imports /devdata/ before they are needed)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../acceptance/runlock.mjs';

const [OUT, ...shots] = process.argv.slice(2);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.GAME_URL || 'http://127.0.0.1:8188/index.html';
const LIMIT_MS = Number(process.env.LIMIT_MS || 20000);
const PORT = 9600 + (process.pid % 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

await acquireLock(`byoc-ui shoot.mjs ${shots.join(' ')}`.slice(0, 200));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `por-byocui-${process.pid}`)}`, '--window-size=1280,800', '--hide-scrollbars', 'about:blank'],
{ stdio: 'ignore' });
setLockChild(chrome.pid, `por-byocui-${process.pid}`);
onRelease(() => chrome.kill());

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
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 15000);
    pending.set(i, (m) => { clearTimeout(t); r(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, close: () => ws.close() }); });
}
const KEYS = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, Tab: 9, PageDown: 34, PageUp: 33, Backspace: 8 };

let failed = 0;
try {
  for (const arg of shots) {
    const eq = arg.indexOf('=');
    const name = arg.slice(0, eq);
    const [query, keys] = arg.slice(eq + 1).split('|');
    const tab = await getJSON(`/json/new?${encodeURIComponent(`${BASE}?${query}`)}`, 'PUT');
    const s = await connect(tab.webSocketDebuggerUrl);
    await s.send('Runtime.enable'); await s.send('Page.enable');
    const ready = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < LIMIT_MS) {
        const r = await s.send('Runtime.evaluate', { expression: 'window.__screenReady === true' });
        if (r.result?.result?.value === true) return true;
        await sleep(150);
      }
      return false;
    };
    if (process.env.PRE) {                          // e.g. mount the gear before main.js does: PRE="import('/byoc/ui/byoc-ui.js').then((m) => m.mountSettings())"
      for (let i = 0; i < 50; i++) { const r = await s.send('Runtime.evaluate', { expression: 'document.readyState' }); if (r.result?.result?.value === 'complete') break; await sleep(100); }
      await s.send('Runtime.evaluate', { expression: process.env.PRE, awaitPromise: true });
    }
    let ok = await ready();
    for (const k of (keys ? keys.split(';') : [])) {
      if (k.startsWith('@')) {                        // @col.row = mouse click on that cell of the BYOC overlay (40x25 grid)
        const [col, row] = k.slice(1).split('.').map(Number);
        const r = await s.send('Runtime.evaluate', { expression: `JSON.stringify(document.getElementById('byoc-screen').getBoundingClientRect())`, returnByValue: true });
        const b = JSON.parse(r.result.result.value);
        const x = b.left + (col + 0.5) * b.width / 40, y = b.top + (row + 0.5) * b.height / 25;
        await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await sleep(250);
        continue;
      }
      const code = KEYS[k] ?? k.toUpperCase().charCodeAt(0);
      const text = k.length === 1 ? k : k === 'Enter' ? '\r' : undefined;
      await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, windowsVirtualKeyCode: code, text });
      await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, windowsVirtualKeyCode: code });
      await sleep(250);
    }
    await sleep(400);
    const r = await s.send('Runtime.evaluate', { expression: `(() => { const E = window.E; if (E) E.pic.display.present();
      const m = document.createElement('canvas'); m.width = 320; m.height = 200; const k = m.getContext('2d');
      const scr = document.getElementById('screen'); if (scr) k.drawImage(scr, 0, 0);
      const ov = document.getElementById('byoc-ui'), cv = document.getElementById('byoc-screen');
      if (ov && cv && ov.style.display !== 'none') k.drawImage(cv, 0, 0);
      return m.toDataURL('image/png'); })()` });
    const data = r.result?.result?.value;
    if (data) writeFileSync(join(OUT, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    const w = await s.send('Page.captureScreenshot', { format: 'png' });
    if (w.result?.data) writeFileSync(join(OUT, `${name}.win.png`), Buffer.from(w.result.data, 'base64'));
    if (process.env.POST) { const ev = await s.send('Runtime.evaluate', { expression: process.env.POST, awaitPromise: true, returnByValue: true }); console.log(`${name}: POST = ${JSON.stringify(ev.result?.result?.value)}`); }
    const id = await s.send('Runtime.evaluate', { expression: 'window.__screenId || null' });
    console.log(`${name}: ${ok ? 'ready' : 'TIMEOUT'} screen=${id.result?.result?.value}${s.errors.length ? ' errors: ' + s.errors.join(' | ') : ''}`);
    if (!ok || s.errors.length) failed++;
    s.close();
    await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
} finally {
  chrome.kill();
  releaseLock();
}
process.exit(failed ? 1 : 0);
