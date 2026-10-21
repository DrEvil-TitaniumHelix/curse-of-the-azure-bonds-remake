// helpers_cab.test.mjs (cab-plus-shell, S6 W8): the Curse side of the helpers.
//  - every W8 helper is off by default (plus.js defaults = helpers HELPER_DEFAULTS), spell presets / margins not offered;
//  - the text read-back works on packed RGB pixels (the presented canvas) with the player's own font, 8X8D1.DAX record C9h;
//  - the combat log takes the Curse payloads (combatEnd { partyDead }, combatTurn { round }, textPrinted in combat);
//  - quick save waits for the Curse explore menu and, without the engine save entry (plus request #11), saves nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { HELPER_DEFAULTS } from '../../plus/helpers/index.js';
import { defaults } from '../../plus/plus.js';
import { glyphTable, readScreen, lineText } from '../../plus/helpers/textcells.js';
import { createCombatModel } from '../../plus/helpers/combatlog.js';
import { createSaves } from '../../plus/helpers/saves.js';
import { archiveRecords } from '../../plus/pedia/build.js';
const root = new URL('../../../', import.meta.url);
const folder = process.env.CAB_DATA || fileURLToPath(new URL('../re-targets/goldbox/cotab/curazure/', root));

test('every W8 helper is off by default; presets and margins are not offered', () => {
 for (const k of ['tooltips', 'combatLog', 'quicksave', 'autosave', 'crispFont', 'spellPresets', 'margins']) { assert.equal(HELPER_DEFAULTS[k], false, k); assert.equal(defaults[k], false, k); }
 const src = readFileSync(new URL('game/plus/plus.js', root), 'utf8');
 assert.match(src, /available = new Set\(\['automap', 'crispFont', 'tooltips', 'combatLog', 'quicksave', 'autosave'\]\)/);
});

test('text read-back on packed RGB pixels with the player font (8X8D1.DAX record C9h)', { skip: existsSync(folder) ? false : 'local player copy unavailable' }, () => {
 const font = archiveRecords(new Uint8Array(readFileSync(path.join(folder, '8X8D1.DAX')))).get(0xC9);
 assert.ok(font && font.length >= 64 * 8, 'font record');
 const table = glyphTable(font), pix = new Uint32Array(320 * 200), colour = 0xFFFF55;
 const put = (col, row, ch) => { const g = ch.toUpperCase().charCodeAt(0) % 64; for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) if (font[g * 8 + r] & (0x80 >> b)) pix[(row * 8 + r) * 320 + col * 8 + b] = colour; };
 [...'ENCAMP'].forEach((c, i) => put(3 + i, 24, c));
 const cells = readScreen(pix, table);
 assert.equal(lineText(cells[24]).trim(), 'ENCAMP'); assert.equal(cells[24][3].colour, colour);
});

test('combat log: Curse combatEnd / combatTurn / textPrinted', () => {
 const m = createCombatModel();
 m.start({ monsters: [{ name: 'SYNTH' }, { name: 'SYNTH' }] }); m.turn({ round: 1, side: 0 }); m.turn({ round: 1, side: 1 }); m.text({ text: 'SYNTH HITS.' }); m.turn({ round: 2 });
 m.end({ partyDead: false, party: [] }); m.start({ monsters: [] }); m.end({ partyDead: true });
 assert.deepEqual(m.entries.map((e) => e.text), ['Combat: 2 × SYNTH', 'Round 1', 'SYNTH HITS.', 'Round 2', 'Combat over', 'Combat: unknown foes', 'The party was destroyed']);
 m.text({ text: 'OUTSIDE COMBAT' }); assert.equal(m.entries.length, 7);
});

test('quick save: only at the Curse explore menu; no engine save entry -> nothing saved, the player is told', async () => {
 const listeners = new Set(), told = [];
 const bus = { on(_, fn) { listeners.add(fn); return () => listeners.delete(fn); }, regions: () => [] };
 const s = createSaves({ bus, notify: (t) => told.push(t) }); s.set('quick', true);
 assert.equal(await s.quickSave(), false); assert.match(told.at(-1), /explore menu/);
 s.safe.event('menuDrawn', { kind: 'hmenu', items: 'Area Cast View Encamp Search Look'.split(' ').map((label) => ({ label })) });
 assert.equal(s.safe.safe, true);
 assert.equal(await s.quickSave(), false); assert.match(told.at(-1), /engine save entry/);
 s.safe.event('combatStart', {}); assert.equal(s.safe.safe, false);
});
