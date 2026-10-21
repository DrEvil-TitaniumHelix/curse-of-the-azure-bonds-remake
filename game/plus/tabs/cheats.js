// Cheats tab (W11, gbp-cheat; developer tools): start a scenario (list or JSON file), edit the live party (levels, HP,
// gold), teleport, set the clock, read/set an ECL flag. Shown only with ?dev=1 (or ?sting=1); off in original-game mode.
// cab: every write goes through the engine's dev entry hooks.dev (plus request #13); scenarios are `cab-scenario` JSON
// (cheats/scenario.js) from game/plus/scenario/data/.
import * as live from '../cheats/live.js';
import { runScenario, validateScenario, FACING } from '../cheats/scenario.js';

const CLASS_IDS = [0, 1, 2, 3, 4, 5, 6, 7];
export function devToolsEnabled(plus) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  return q.get('dev') === '1' || q.get('sting') === '1' || plus?.settings?.devTools === true;
}

function el(tag, props = {}, ...kids) { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; }
function field(label, input) { return el('label', {}, label + ' ', input); }
function num(value, min, max, aria) { return el('input', { type: 'number', value: String(value), min: String(min), max: String(max), ariaLabel: aria }); }

export function registerCheatsTab(plus, { scenarios = () => fetch(new URL('../scenario/data/index.json', import.meta.url)).then((r) => r.json()), install = runScenario } = {}) {   // cab: param
  plus.registerTab('cheats', (container) => {
    container.append(el('h2', { textContent: 'Cheats (developer tools)' }));
    if (plus.settings.original) { container.append(el('p', { textContent: 'Cheats are off in original-game mode.' })); return; }
    if (!devToolsEnabled(plus)) { container.append(el('p', { textContent: 'Developer tools are off. Start with ?dev=1 to use them.' })); return; }
    const status = el('p', { role: 'status' }); status.dataset.cheat = 'status';
    const say = (t) => { status.textContent = t; };
    const run = (fn) => async () => { try { say(await fn() || 'Done.'); } catch (e) { say('Not applied: ' + e.message); } };

    // scenario
    const list = el('select', { ariaLabel: 'Scenario' }), file = el('input', { type: 'file', accept: '.json,application/json', ariaLabel: 'Scenario JSON file' });
    const installBtn = el('button', { textContent: 'Start selected scenario' });
    installBtn.dataset.cheat = 'install';
    scenarios().then((names) => { for (const n of names) list.append(el('option', { value: n, textContent: n })); }).catch(() => say('Scenario list unavailable.'));
    const done = (b) => `Scenario ${b.scenario.name || ''} handed to the game: ${b.party.length} characters (applied at the next safe point).`;   // cab
    installBtn.onclick = run(async () => done(await install(list.value)));
    file.onchange = run(async () => { const s = JSON.parse(await file.files[0].text()); validateScenario(s); return done(await install(s)); });
    container.append(el('h3', { textContent: 'Scenario' }), el('p', {}, list, ' ', installBtn), el('p', {}, field('or a JSON file', file)));

    // live party
    const partyBox = el('div'); partyBox.dataset.cheat = 'party';
    container.append(el('h3', { textContent: 'Party (current game)' }), partyBox);
    Promise.resolve().then(() => live.liveParty()).then((party) => {   // cab: from hooks.state
      for (const m of party) {
        const row = el('fieldset'); row.dataset.member = String(m.index);
        row.append(el('legend', { textContent: m.name }));
        const lv = CLASS_IDS.filter((k) => m.levels[k] > 0).map((k) => [k, num(m.levels[k], 1, 127, `${m.name} level, class ${k}`)]);
        const hp = num(m.hp, 0, 255, `${m.name} HP`), gold = num(m.gold, 0, 65535, `${m.name} gold`), cheat = el('input', { type: 'checkbox', ariaLabel: `${m.name}: allow HP above maximum` });
        lv.forEach(([, i]) => row.append(field('Level', i)));
        row.append(field('HP', hp), ` / ${m.hpMax} `, field('above max', cheat), field('Gold', gold));
        const apply = el('button', { textContent: 'Apply' }); apply.dataset.cheat = 'apply';
        apply.onclick = run(async () => {
          for (const [k, i] of lv) if (Number(i.value) !== m.levels[k]) await live.setLevel(m.index, k, Number(i.value));
          await live.setHp(m.index, Number(hp.value), { cheat: cheat.checked });
          await live.setGold(m.index, Number(gold.value));
          return `${m.name} updated.`;
        });
        row.append(apply); partyBox.append(row);
      }
      if (!party.length) partyBox.textContent = 'No party yet.';
    }).catch((e) => { partyBox.textContent = 'Party unavailable: ' + e.message; });

    // teleport (current map) and flags
    const x = num(0, 0, 15, 'Teleport x'), y = num(0, 0, 15, 'Teleport y'), face = el('select', { ariaLabel: 'Facing' });
    for (const f of Object.keys(FACING)) face.append(el('option', { value: f, textContent: f }));
    const tp = el('button', { textContent: 'Teleport' }); tp.dataset.cheat = 'teleport';
    const ds = el('input', { type: 'number', min: '1', max: '6', placeholder: 'set', ariaLabel: 'Data set (empty: this one)', size: 3 }), blk = el('input', { type: 'number', min: '0', max: '255', placeholder: 'block', ariaLabel: 'Block (empty: this one)', size: 4 });
    const opt = (i) => (i.value === '' ? null : Number(i.value));
    tp.onclick = run(async () => { await live.teleport(Number(x.value), Number(y.value), FACING[face.value], { dataset: opt(ds), block: opt(blk) }); return `Party to ${x.value},${y.value} ${face.value} at the next safe point.`; });
    container.append(el('h3', { textContent: 'Teleport' }), el('p', {}, field('x', x), field('y', y), field('facing', face), field('data set', ds), field('block', blk), tp));
    const hour = num(0, 0, 23, 'Hour'), minute = num(0, 0, 59, 'Minute'), day = num(1, 0, 29, 'Day'), month = num(0, 0, 11, 'Month'), year = num(0, 0, 65535, 'Year');
    const clockBtn = el('button', { textContent: 'Set clock' }); clockBtn.dataset.cheat = 'clock';
    clockBtn.onclick = run(async () => { await live.setClock({ hour: Number(hour.value), minute: Number(minute.value), day: Number(day.value), month: Number(month.value), year: Number(year.value) }); return 'Clock set at the next safe point.'; });
    container.append(el('h3', { textContent: 'Clock' }), el('p', {}, field('hour', hour), field('minute', minute), field('day', day), field('month', month), field('year', year), clockBtn));
    const addr = el('input', { type: 'text', placeholder: '4AA7', size: 6, ariaLabel: 'Flag address (hex)' }), value = el('input', { type: 'text', placeholder: '0xFE', size: 6, ariaLabel: 'Flag value' });
    const read = el('button', { textContent: 'Read' }), set = el('button', { textContent: 'Set flag' }); set.dataset.cheat = 'flag';
    const parseAddr = () => { if (!/^(0x)?[0-9a-f]{1,4}$/i.test(addr.value.trim())) throw new Error('address: hex, e.g. 4AA7'); return parseInt(addr.value.trim().replace(/^0x/i, ''), 16); };
    read.onclick = run(async () => `Flag ${addr.value.toUpperCase()} = ${(await live.getFlag(parseAddr())).toString(16).toUpperCase()}h`);
    set.onclick = run(async () => `Flag ${addr.value.toUpperCase()} := ${(await live.setFlag(parseAddr(), Number(value.value))).toString(16).toUpperCase()}h`);
    container.append(el('h3', { textContent: 'Flag' }), el('p', {}, field('address', addr), field('value', value), read, set),
      el('p', { textContent: 'Flags are words of the saved ECL regions 4B00..4EFF and 7A00..7FFF (decode/ecl/ECL_VM.md).' }), status);
  });
}
