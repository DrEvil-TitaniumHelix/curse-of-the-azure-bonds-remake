// quests-shot.mjs (cab-ecl-quests, W5) — headless Chrome shots of the Quests tab over the running game. In the page:
// Plus (mounted by the boot) gets the Quests page (registered here until plus request #14 lands); synthetic events go
// through the real hooks.js as the scripts raise them: textPrinted with the instruction address of two offers (ECL1_80
// 8389, ECL1_81 90E4) and flagSet writes (4C2A := 1 as at ECL2_04 842F, 4C86 := 2 as at ECL1_81 93DF). Texts are decoded
// from the player's ECLn.DAX the dev server reads. Checks: nothing listed before the events, exactly those quests after
// with the expected status, every shown text decoded, the game canvas unchanged.
// Screens go to acceptance/local/plus/quests-<case>-<step>.png (gitignored: they show the game's texts); the report
// with their SHA-256 is acceptance/reports/plus/PLUS-QUESTS.json. Takes the shared run lock; foreground only.
// Starts its own `tools/serve.py <port> --dev` unless GAME_URL is given.   Usage: node game/test/plus/quests-shot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../../PoolRadianceRE/acceptance/runlock.mjs';
import { ROOT, local, report, sha256 } from '../../../acceptance/paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTTP = 8193, PORT = 9600 + (process.pid % 300);
const BASE = process.env.GAME_URL || `http://127.0.0.1:${HTTP}/index.html`;
const ROUTE = process.env.ROUTE || 'screen=S015&fast=4';   // titles + the Play Demo prompt (REF-S015)
const CASES = [{ id: 'desktop', width: 1000, height: 700 }, { id: 'phone', width: 360, height: 640, mobile: true }];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = local('plus');

await acquireLock('cab-ecl-quests quests-shot.mjs');
const server = process.env.GAME_URL ? null
  : spawn('python', ['-I', 'tools/serve.py', String(HTTP), '--dev'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `cab-quests-shot-${process.pid}`)}`, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-quests-shot-${process.pid}`);
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
    const t = setTimeout(() => { pending.delete(i); j(new Error(`${method} timed out`)); }, 30000);
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

// step 1: Plus up, the Quests page registered and opened, nothing met yet
const SETUP = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.getElementById('screen'); if (window.E) window.E.pic.display.present();
  window.__questsBefore = canvas.toDataURL();
  let p = window.goldBoxPlus; if (!p) { p = (await import('/plus/plus.js')).mountPlus(); }
  await p.ready;
  window.goldBoxPlusTabs ||= {};
  if (!window.goldBoxPlusTabs.quests) window.goldBoxPlusTabs.quests = (await import('/plus/tabs/quests.js')).registerQuestsTab(p, { profile: 'cab' });
  const tracker = window.goldBoxPlusTabs.quests; await tracker.ready.catch(() => {});
  const nav = document.querySelector('#por-plus [role=tablist]'), row = !!nav.querySelector('[data-tab=quests]');
  if (!row) { const b = document.createElement('button'); b.dataset.tab = 'quests'; b.textContent = 'Quests'; b.setAttribute('role', 'tab'); b.onclick = () => p.selectTab('quests'); nav.insertBefore(b, nav.children[1]); }
  p.open(); p.selectTab('quests'); await frames();
  const body = document.getElementById('por-plus-content');
  return { tabRow: row, texts: tracker.log.texts.size, listed: body.querySelectorAll('li[data-quest]').length, status: body.querySelector('[role=status]')?.textContent || '' };
})()`;
// step 2: the events as the scripts raise them
const EVENTS = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { hooks } = await import('/plus/hooks.js'); const was = hooks.enabled; hooks.enabled = true;
  hooks.emit('textPrinted', { text: '', window: 'text', source: 'PRINT', addr: 0x8389, block: 80, dataset: 1 });
  hooks.emit('textPrinted', { text: '', window: 'text', source: 'PRINTCLEAR', addr: 0x90E4, block: 81, dataset: 1 });
  hooks.emit('flagSet', { addr: 0x4C2A, value: 1, old: 0, region: 0, pc: 0x842F });
  hooks.emit('flagSet', { addr: 0x4C86, value: 2, old: 1, region: 0, pc: 0x93DF });
  hooks.enabled = was; window.goldBoxPlus.selectTab('quests'); await frames();
  const body = document.getElementById('por-plus-content');
  const rows = [...body.querySelectorAll('li[data-quest]')].map((li) => ({ id: li.dataset.quest, status: li.dataset.status, length: li.textContent.length, missing: /text unavailable/.test(li.textContent) }));
  if (window.E) window.E.pic.display.present();
  return { rows, canvasUnchanged: window.__questsBefore === document.getElementById('screen').toDataURL() };
})()`;

const results = [];
let failed = 0;
try {
  for (const c of CASES) {
    const tab = await getJSON('/json/new?about:blank', 'PUT');
    const s = await connect(tab.webSocketDebuggerUrl);
    await s.send('Runtime.enable'); await s.send('Page.enable');
    await s.send('Emulation.setDeviceMetricsOverride', { width: c.width, height: c.height, deviceScaleFactor: 1, mobile: !!c.mobile });
    await s.send('Page.navigate', { url: `${BASE}?${ROUTE}` });
    const t0 = Date.now(); let ready = false;
    while (Date.now() - t0 < 30000) { if (await evaluate(s, 'window.__screenReady === true').catch(() => false)) { ready = true; break; } await sleep(200); }
    await sleep(300);
    const steps = {}, shots = [];
    let error = null;
    const shoot = async (step) => {
      const shot = await s.send('Page.captureScreenshot', { format: 'png' }), png = Buffer.from(shot.result.data, 'base64');
      writeFileSync(join(OUT, `quests-${c.id}-${step}.png`), png); shots.push({ step, file: `acceptance/local/plus/quests-${c.id}-${step}.png`, sha256: sha256(png) });
    };
    try {
      steps.setup = await evaluate(s, SETUP); await shoot('empty');
      steps.events = await evaluate(s, EVENTS); await shoot('met');
    } catch (e) { error = String(e.message || e); }
    const { setup, events } = steps;
    const checks = setup && events ? {
      emptyBeforeEvents: setup.listed === 0 && /^No quests met yet/.test(setup.status),
      textsDecoded: setup.texts > 0 && events.rows.every((r) => !r.missing && r.length > 12),
      statuses: events.rows.map((r) => `${r.id}:${r.status}`).join() === 'tilverton:done,moander:offered,dagger-falls:rewarded',
      canvasUnchanged: events.canvasUnchanged,
      tabRow: setup.tabRow ? true : 'PENDING plus request #14',
    } : null;
    const pass = ready && !error && !s.errors.length && checks && Object.values(checks).every((v) => v === true || String(v).startsWith('PENDING'));
    if (!pass) failed++;
    results.push({ case: c.id, viewport: [c.width, c.height], url: `${BASE}?${ROUTE}`, ready, error, errors: s.errors, checks, steps, shots, verdict: pass ? 'PASS' : 'FAIL' });
    console.log(`${c.id}: ${pass ? 'PASS' : 'FAIL'}${error ? ' error: ' + error : ''}${s.errors.length ? ' errors: ' + s.errors.join(' | ') : ''} ${JSON.stringify(checks)}`);
    s.close();
    await getJSON(`/json/close/${tab.id}`).catch(() => {});
  }
} finally {
  chrome.kill(); server?.kill();
  releaseLock();
}
writeFileSync(report('plus', 'PLUS-QUESTS'), JSON.stringify({ id: 'PLUS-QUESTS', utc: new Date().toISOString(), results }, null, 1) + '\n');
console.log(failed ? `FAIL ${failed}` : 'PASS'); process.exit(failed ? 1 : 0);
