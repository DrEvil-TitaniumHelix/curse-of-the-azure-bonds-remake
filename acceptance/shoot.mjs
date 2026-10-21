// shoot.mjs (cab-build-engine; fork of PoolRadianceRE/acceptance/shoot.mjs) — headless Chrome screenshots of build screens
// for the DOSBox comparison. The run lock is the SHARED one of PoolRadianceRE/acceptance (one headless Chrome/DOSBox run
// across all projects).
// Each id opens index.html?screen=<id>&<extra>; the build sets window.__screenReady when that screen is complete
// (game/engine/dev.js); the 320x200 canvas is saved natively to acceptance/local/shoot/<id>.png (gitignored, BYOC step 7)
// and its SHA-256 goes to the committed report acceptance/reports/shoot/<id>.json. Chrome is closed at the end.
// Needs: python -I tools/serve.py 8189 --dev.   Usage: node acceptance/shoot.mjs [<name>=]<id>[?extra-query] ...
// Takes the shared run lock itself (acceptance/runlock.mjs); do not wrap it in a hand-made mkdir lock.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../PoolRadianceRE/acceptance/runlock.mjs';
import { local, report, sha256 } from './paths.mjs';

const OUT = local('shoot');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.GAME_URL || 'http://127.0.0.1:8189/index.html';
const LIMIT_MS = Number(process.env.LIMIT_MS || 30000);
const PORT = 9300 + (process.pid % 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

await acquireLock(`shoot.mjs ${process.argv.slice(2).join(' ')}`.slice(0, 200));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `cab-shoot-${process.pid}`)}`, '--window-size=640,400', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-shoot-${process.pid}`);
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
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (process.env.WARN && m.method === 'Runtime.consoleAPICalled' && m.params.type === 'warning') console.log('  warn: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 15000);
    pending.set(i, (m) => { clearTimeout(t); r(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, close: () => ws.close() }); });
}

let failed = 0;
try {
  for (const arg of process.argv.slice(2)) {
    // <id>[?query] or <name>=<id>[?query] (saved as <name>.png); id 'idle' = the screen when the key script is done
    const [lhs, extra] = arg.split('?');
    const [name, target] = lhs.includes('=') ? lhs.split('=') : [lhs, lhs];
    const shotId = name;
    const url = `${BASE}?screen=${target}${extra ? '&' + extra : ''}`;
    const tab = await getJSON(`/json/new?${encodeURIComponent(url)}`, 'PUT');
    const s = await connect(tab.webSocketDebuggerUrl);
    await s.send('Runtime.enable');
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < LIMIT_MS) {
      const r = await s.send('Runtime.evaluate', { expression: 'window.__screenReady === true' });
      if (r.result?.result?.value === true) { ready = true; break; }
      await sleep(200);
    }
    await sleep(300);   // one presented frame after the signal
    const r = await s.send('Runtime.evaluate', { expression: `(() => { const E = window.E; if (E) E.pic.display.present();
      const scr = document.getElementById('screen'); const ov = [...document.querySelectorAll('canvas')].find((x) => x !== scr);
      if (!ov) return scr.toDataURL('image/png');
      const m = document.createElement('canvas'); m.width = 320; m.height = 200; const k = m.getContext('2d');
      k.drawImage(scr, 0, 0); k.drawImage(ov, 0, 0); return m.toDataURL('image/png'); })()` });  // + error overlay if any
    const data = r.result?.result?.value;
    const png = data ? Buffer.from(data.split(',')[1], 'base64') : null;
    if (png) writeFileSync(join(OUT, `${shotId}.png`), png);
    const le = await s.send('Runtime.evaluate', { expression: "(() => { try { return localStorage.getItem('cab:lastError'); } catch (e) { return null; } })()" });
    if (process.env.EVAL) { const ev = await s.send('Runtime.evaluate', { expression: process.env.EVAL, awaitPromise: true, returnByValue: true }); console.log(`${shotId}: EVAL = ${JSON.stringify(ev.result?.result?.value)}`); }
    if (le.result?.result?.value) console.log(`${shotId}: cab:lastError = ${le.result.result.value.slice(0, 300)}`);
    console.log(`${shotId}: ${ready ? 'ready' : 'TIMEOUT'}${s.errors.length ? ' errors: ' + s.errors.join(' | ') : ''}`);
    writeFileSync(report('shoot', shotId), JSON.stringify({ id: shotId, url, ready, errors: s.errors, file: `acceptance/local/shoot/${shotId}.png`,
      sha256: png ? sha256(png) : null, utc: new Date().toISOString() }, null, 1) + '\n');
    if (!ready || s.errors.length) failed++;
    s.close();
    await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
} finally {
  chrome.kill();
  releaseLock();
}
process.exit(failed ? 1 : 0);
