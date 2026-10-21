// pedia-shot.mjs (cab-plus-pedia, S5) — headless Chrome shots of the Pedia tab over the running game. In the page: Plus
// (mounted by the boot, plus request #5) gets the Pedia page (registered here until plus request #9 lands), synthetic
// hook events go through the real hooks.js (monsterShown with its CPIC icon, combatStart, bigPicShown, a treasure type),
// the catalogue is built from the player's files the dev server reads, then search and the category filter are driven.
// Checks: nothing is listed before an event, exactly the revealed entries after, search / filter narrow them, the
// monster detail shows the record values and its icon, the BIGPIC place its picture, the game canvas is unchanged.
// Screens go to acceptance/local/plus/pedia-<case>-<step>.png (gitignored: they show the original art); the report
// with their SHA-256 is acceptance/reports/plus/PLUS-PEDIA.json. Takes the shared run lock; foreground only.
// Starts its own `tools/serve.py <port> --dev` unless GAME_URL is given.   Usage: node game/test/plus/pedia-shot.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, setLockChild, onRelease, releaseLock } from '../../../../PoolRadianceRE/acceptance/runlock.mjs';
import { ROOT, local, report, sha256 } from '../../../acceptance/paths.mjs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTTP = 8192, PORT = 9600 + (process.pid % 300);
const BASE = process.env.GAME_URL || `http://127.0.0.1:${HTTP}/index.html`;
const ROUTE = process.env.ROUTE || 'screen=S015&fast=4';   // titles + the Play Demo prompt (REF-S015)
const CASES = [{ id: 'desktop', width: 1000, height: 700 }, { id: 'phone', width: 360, height: 640, mobile: true }];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = local('plus');

await acquireLock('cab-plus-pedia pedia-shot.mjs');
const server = process.env.GAME_URL ? null
  : spawn('python', ['-I', 'tools/serve.py', String(HTTP), '--dev'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `cab-pedia-shot-${process.pid}`)}`, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
setLockChild(chrome.pid, `cab-pedia-shot-${process.pid}`);
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

// step 1: Plus up, the Pedia page registered and opened, nothing revealed yet
const SETUP = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.getElementById('screen'); if (window.E) window.E.pic.display.present();
  window.__pediaBefore = canvas.toDataURL();
  let p = window.goldBoxPlus; if (!p) { p = (await import('/plus/plus.js')).mountPlus(); }
  await p.ready;
  window.goldBoxPlusTabs ||= {};
  if (!window.goldBoxPlusTabs.pedia) window.goldBoxPlusTabs.pedia = (await import('/plus/tabs/pedia.js')).registerPediaTab(p, { profile: 'cab' });
  const nav = document.querySelector('#por-plus [role=tablist]'), row = !!nav.querySelector('[data-tab=pedia]');
  if (!row) { const b = document.createElement('button'); b.dataset.tab = 'pedia'; b.textContent = 'Pedia'; b.setAttribute('role', 'tab'); b.onclick = () => p.selectTab('pedia'); nav.insertBefore(b, nav.children[1]); }
  p.open(); p.selectTab('pedia');
  const body = document.getElementById('por-plus-content');
  for (let i = 0; i < 300 && !/discoveries/.test(body.querySelector('[role=status]')?.textContent || ''); i++) await new Promise((r) => setTimeout(r, 100));
  await window.goldBoxPlusTabs.pedia.tracker.catalog(); await frames();
  return { tabRow: row, status: body.querySelector('[role=status]')?.textContent || '', listed: body.querySelectorAll('button').length };
})()`;
// step 2: synthetic events through hooks.js; the list shows exactly what they proved
const REVEAL = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { hooks } = await import('/plus/hooks.js'); const was = hooks.enabled; hooks.enabled = true;
  const reg = window.goldBoxPlusTabs.pedia, cat = await reg.tracker.catalog();
  const mon = cat.entries.find((e) => e.id === 'monster:6:64'), other = cat.entries.find((e) => e.id === 'monster:3:19');
  hooks.emit('monsterShown', { id: 64, dataset: 6, name: mon.name, pic: 64, count: 1, ref: { dax: 'MON6CHA', record: 64 }, icon: { dax: 'CPIC6', record: 64 } });
  hooks.emit('combatStart', { monsters: [{ name: other.name, monsterId: 19, dataset: 3, hp: 40, ac: 2 }] });
  hooks.emit('bigPicShown', { id: 121 });
  hooks.emit('treasure', { items: [{ name: 'x', type: 36 }], money: [], afterCombat: true });
  await reg.tracker.flush(); hooks.enabled = was; reg.refresh(); await frames();
  const body = document.getElementById('por-plus-content');
  return { names: [...body.querySelectorAll('div > button')].map((b) => b.textContent), status: body.querySelector('[role=status]').textContent,
    expected: [mon.name, other.name, '2D backdrop 121', 'Item type 36'].sort((a, b) => a.localeCompare(b)), monster: mon.name };
})()`;
// step 3: open the monster: record values + its CPIC icon
const DETAIL = (name) => `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const body = document.getElementById('por-plus-content');
  [...body.querySelectorAll('div > button')].find((b) => b.textContent === ${JSON.stringify(name)}).click();
  for (let i = 0; i < 50 && !body.querySelector('article canvas'); i++) await new Promise((r) => setTimeout(r, 100));
  await frames(); const a = body.querySelector('article'), c = a.querySelector('canvas');
  return { heading: a.querySelector('h3').textContent, icon: c ? [c.width, c.height] : null, stats: [...a.querySelectorAll('dt')].map((d) => d.textContent),
    where: a.textContent.includes('Where met') };
})()`;
// step 4: search + filter narrow the list; the BIGPIC place shows its picture; the canvas is untouched
const SEARCH = `(async () => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const body = document.getElementById('por-plus-content'), input = body.querySelector('input[type=search]'), filter = body.querySelector('select');
  const list = () => [...body.querySelectorAll('div > button')].map((b) => b.textContent);
  input.value = 'backdrop'; input.oninput(); await frames(); const searched = list();
  input.value = ''; input.oninput(); filter.value = 'monster'; filter.onchange(); await frames(); const monsters = list();
  filter.value = 'place'; filter.onchange(); await frames();
  [...body.querySelectorAll('div > button')][0].click();
  for (let i = 0; i < 50 && !body.querySelector('article canvas'); i++) await new Promise((r) => setTimeout(r, 100));
  await frames(); const c = body.querySelector('article canvas');
  if (window.E) window.E.pic.display.present();
  return { searched, monsters, picture: c ? [c.width, c.height] : null, canvasUnchanged: window.__pediaBefore === document.getElementById('screen').toDataURL() };
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
      writeFileSync(join(OUT, `pedia-${c.id}-${step}.png`), png); shots.push({ step, file: `acceptance/local/plus/pedia-${c.id}-${step}.png`, sha256: sha256(png) });
    };
    try {
      steps.setup = await evaluate(s, SETUP); await shoot('empty');
      steps.reveal = await evaluate(s, REVEAL); await shoot('revealed');
      steps.detail = await evaluate(s, DETAIL(steps.reveal.monster)); await shoot('monster');
      steps.search = await evaluate(s, SEARCH); await shoot('place');
    } catch (e) { error = String(e.message || e); }
    const { setup, reveal, detail, search } = steps;
    const checks = setup && reveal && detail && search ? {
      emptyBeforeEvents: setup.listed === 0 && /^0 discoveries/.test(setup.status),
      revealedExactly: JSON.stringify(reveal.names) === JSON.stringify(reveal.expected),
      monsterDetail: detail.heading === reveal.monster && JSON.stringify(detail.icon) === '[24,24]' && ['Level / hit dice', 'Base AC', 'Base THAC0', 'Base damage'].every((k) => detail.stats.includes(k)) && detail.where,
      search: search.searched.join() === '2D backdrop 121',
      filter: search.monsters.length === 2,
      placePicture: JSON.stringify(search.picture) === '[304,120]',
      canvasUnchanged: search.canvasUnchanged,
      tabRow: setup.tabRow ? true : 'PENDING plus request #9',
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
writeFileSync(report('plus', 'PLUS-PEDIA'), JSON.stringify({ id: 'PLUS-PEDIA', utc: new Date().toISOString(), results }, null, 1) + '\n');
console.log(failed ? `FAIL ${failed}` : 'PASS'); process.exit(failed ? 1 : 0);
