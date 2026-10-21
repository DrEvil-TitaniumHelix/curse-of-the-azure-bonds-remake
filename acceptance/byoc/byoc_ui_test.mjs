// byoc_ui_test.mjs (cab-build-engine, step 0 of herdr/assignments/cab-plus-hooks.md) — the BYOC v1.0 import path end to
// end through the real screens, in headless Chrome against a PLAYER-mode server (no /devdata/, no /data/):
//   fresh browser store -> BY-1 -> key S (SELECT FILES OR FOLDER) -> the browser's file chooser (intercepted over CDP,
//   answered with the scratch folder acceptance/local/byoc/<case>/ = what a player picks) -> BY-2 checking -> BY-3 OK or
//   BY-4 refused -> (OK) key S START -> the game boots from IndexedDB only -> first title (?screen=S010) -> a reload of the
//   page boots straight to the titles (the import is kept).
// Shots: acceptance/local/byoc/shots/<case>-<step>.png (local: original art); results + SHA-256: acceptance/reports/byoc/<case>.json.
// Needs: python -I tools/serve.py 8190 --player   and   python -I acceptance/byoc/make_copies.py
// Usage: node acceptance/byoc/byoc_ui_test.mjs [case ...]   (default: owner retail74 badbyte otherver poolrad)
// Takes the shared run lock (PoolRadianceRE/acceptance/runlock.mjs); one Chrome per case (= one fresh browser store).
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../PoolRadianceRE/acceptance/runlock.mjs';
import { local, report, sha256, ROOT } from '../paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.GAME_URL || 'http://127.0.0.1:8190/index.html';
const URL_ = `${BASE}?screen=S010&fast=4`;
const SHOTS = local('byoc', 'shots');
const CASES = process.argv.length > 2 ? process.argv.slice(2) : ['owner', 'retail74', 'badbyte', 'otherver', 'poolrad'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(port, path, method = 'GET') {
  for (let i = 0; i < 150; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${path}`, { method })).json(); } catch { await sleep(200); }
  }
  throw new Error('chrome did not start');
}
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map(), errors = [], events = [], requests = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') requests.push(new URL(m.params.request.url).pathname);
    events.push(m);
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id;
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 30000);
    pending.set(i, (m) => { clearTimeout(t); m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return new Promise((r) => { ws.onopen = () => r({ send, errors, events, requests, close: () => ws.close() }); });
}
const evalJS = async (s, expr) => (await s.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
async function until(s, expr, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await evalJS(s, expr)) return true; await sleep(150); }
  return false;
}
async function key(s, k) {
  const code = k.length === 1 ? 'Key' + k.toUpperCase() : k;
  const vk = k.length === 1 ? k.toUpperCase().charCodeAt(0) : { Enter: 13 }[k];
  await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk });
  await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
}
// the BYOC overlay (#byoc-screen) while it is shown, else the game canvas; 320x200 natively
async function shot(s, name) {
  const data = await evalJS(s, `(() => { const E = window.E; if (E && E.pic && E.pic.display) E.pic.display.present();
    const ov = document.getElementById('byoc-ui'), cv = document.getElementById('byoc-screen');
    const src = ov && ov.style.display !== 'none' && cv ? cv : document.getElementById('screen');
    return src.toDataURL('image/png'); })()`);
  const png = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(join(SHOTS, `${name}.png`), png);
  return { shot: `acceptance/local/byoc/shots/${name}.png`, sha256: sha256(png) };
}

const BY_SHOWN = "(() => { const o = document.getElementById('byoc-ui'); return !!o && o.style.display !== 'none'; })()";

async function runCase(name) {
  // poolrad = the player's Pool of Radiance folder, picked in place (read only by the browser): another game, not a version
  const folder = name === 'poolrad' ? resolve(ROOT, '..', 're-targets', 'goldbox', 'por', 'POOLRAD') : resolve(local('byoc'), name);
  if (!existsSync(join(folder, 'START.EXE')) && !existsSync(join(folder, 'ST.EXE'))) throw new Error(`no scratch copy ${folder} (run make_copies.py / make_copies_v13.py)`);   // cab: v13-4 ST.EXE
  const port = 9900 + (process.pid % 50) + CASES.indexOf(name);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(tmpdir(), `cab-byoc-${name}-${process.pid}`)}`, '--window-size=1280,800', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  setLockChild(chrome.pid, `cab-byoc-${name}-${process.pid}`);
  const out = { case: name, folder: name === 'poolrad' ? 're-targets/goldbox/por/POOLRAD (in place)' : `acceptance/local/byoc/${name}`, url: URL_, steps: [], utc: new Date().toISOString() };
  const step = (id, extra) => { out.steps.push({ id, ...extra }); console.log(`${name} ${id}: ${JSON.stringify(extra).slice(0, 300)}`); };
  try {
    const tab = await getJSON(port, `/json/new?about:blank`, 'PUT');
    const s = await connect(tab.webSocketDebuggerUrl);
    await s.send('Runtime.enable'); await s.send('Page.enable'); await s.send('Network.enable'); await s.send('DOM.enable');
    await s.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await s.send('Page.navigate', { url: URL_ });
    // 1. BY-1 import screen (nothing imported, the player server has no dev data)
    const by1 = await until(s, BY_SHOWN);
    step('BY-1', { shown: by1, ...(await shot(s, `${name}-1-BY1`)) });
    if (!by1) throw new Error('BY-1 not shown');
    // 2. S = SELECT FILES OR FOLDER -> the file chooser -> answer it with the scratch folder
    const mark = s.events.length;
    await key(s, 's');
    let chooser = null;
    for (let i = 0; i < 100 && !chooser; i++) { chooser = s.events.slice(mark).find((e) => e.method === 'Page.fileChooserOpened'); if (!chooser) await sleep(100); }
    if (!chooser) throw new Error('no file chooser opened');
    await s.send('DOM.setFileInputFiles', { files: [folder], backendNodeId: chooser.params.backendNodeId });
    step('picker', { mode: chooser.params.mode, picked: out.folder });
    // 3. BY-2 checking -> BY-3 / BY-4
    const checked = await until(s, '!!window.__byocReport', 120000);
    await sleep(400);
    const rep = await evalJS(s, `(() => { const r = window.__byocReport; return r && { ok: r.ok, manifestId: r.manifestId, okCount: r.okCount,
      requiredCount: r.requiredCount, likelyOtherVersion: r.likelyOtherVersion, gameOvr: r.gameOvr, variant: r.variant || null,
      bad: r.files.filter((f) => f.status !== 'ok' && f.required).map((f) => f.name + ':' + f.status), saves: (r.saves || []).length }; })()`);
    await until(s, `(() => { const t = document.getElementById('byoc-screen'); return !!t; })()`, 2000);
    await sleep(800);                                                      // BY-3 / BY-4 drawn after the store write
    const text = await evalJS(s, "document.body.innerText");
    step(rep && rep.ok ? 'BY-3' : 'BY-4', { checked, report: rep, ...(await shot(s, `${name}-2-${rep && rep.ok ? 'BY3' : 'BY4'}`)) });
    out.result = rep && rep.ok ? 'accepted' : 'refused';
    if (!rep || !rep.ok) return out;
    // 4. START -> the game boots from IndexedDB -> first title S010
    const reqMark = s.requests.length;
    await key(s, 's');
    const ready = await until(s, 'window.__screenReady === true', 60000);
    await sleep(300);
    const fromServer = s.requests.slice(reqMark).filter((p) => /^\/(dev)?data\//i.test(p));
    const stored = await evalJS(s, `new Promise((res) => { const q = indexedDB.open('${'cab-data'}'); q.onerror = () => res(null);
      q.onsuccess = () => { const db = q.result; res({ stores: [...db.objectStoreNames] }); db.close(); }; })`);
    // cab: v13-1 — which profile booted (version / overlay) and the DS image the engine built from the imported executable
    const booted = await evalJS(s, `(() => { const E = window.E; if (!E || !E.profile || !E.G || !E.G.ds) return null; const ds = E.G.ds;
      return { version: E.profile.version, variant: E.profile.variant || null, executable: E.profile.engine.state.executable,
        dsBytes: ds.length, runeRow0: String.fromCharCode(...ds.subarray(1, 13)), titleAt6: E.G.image ? String.fromCharCode(...E.G.image.subarray(7, 37)) : null,
        audioSeg: E.profile.engine.audio ? E.profile.engine.audio.segment : null }; })()`);
    step('S010', { ready, dataRequests: fromServer, idb: stored, booted, ...(await shot(s, `${name}-3-S010`)) });
    // 5. reload: the import is kept, no BY-1
    await s.send('Page.navigate', { url: URL_ });
    await sleep(1500);
    const again = await until(s, 'window.__screenReady === true', 60000);
    const by1Again = await evalJS(s, BY_SHOWN);
    step('reload-S010', { ready: again, by1Shown: by1Again, ...(await shot(s, `${name}-4-reload-S010`)) });
    out.errors = s.errors;
    s.close();
    return out;
  } finally {
    chrome.kill();
  }
}

await acquireLock(`byoc_ui_test.mjs ${CASES.join(' ')}`);
onRelease(() => {});
let failed = 0;
try {
  for (const c of CASES) {
    let r;
    try { r = await runCase(c); } catch (e) { r = { case: c, error: String(e.message || e) }; failed++; console.log(`${c}: ERROR ${r.error}`); }
    writeFileSync(report('byoc', c), JSON.stringify(r, null, 1) + '\n');
  }
} finally { releaseLock(); }
process.exit(failed ? 1 : 0);
