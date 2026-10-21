// profile-plus.test.mjs (cab-plus-shell, W10): the Plus fields of game/profiles/cab.json (owned by cab-build-engine;
// additions go as plus requests) and the Games selector rows (cab startable, por listed for its own build).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OTHER_GAMES, PROFILE_URLS } from '../../plus/games.js';
const root = new URL('../../', import.meta.url);
const profile = JSON.parse(await readFile(new URL('profiles/cab.json', root), 'utf8'));
test('char-summary field map lies inside the 422-byte record', () => {
 const f = profile.plus?.charFields; assert.ok(f, 'cab.json plus.charFields');
 assert.equal(profile.recordSizes.TChar, 422);
 for (const [k, v] of Object.entries(f)) if (k !== 'nameMax') assert.ok(Number.isInteger(v) && v > 0 && v < 422, k);
 assert.ok(f.levels + 8 <= 422 && f.money + 14 <= 422 && f.xp + 4 <= 422);
 assert.equal(profile.plus.partyList, 'PartyList');
});
test('quest table: the Curse table module (plus request #15/#16), evidence in decode/ecl/QUESTS.md', async () => {
 assert.equal(profile.questTable.status, 'table'); assert.equal(profile.questTable.source, 'decode/ecl/QUESTS.md');
 const mod = await import(new URL(profile.questTable.module, new URL('profiles/cab.json', root)).href);
 assert.equal(mod.PROFILE, 'cab'); assert.ok(Object.keys(mod.QUESTS).length > 0);
});
test('pedia sources (plus request #7) name only player data groups of the profile', { todo: Object.keys(profile.pediaSources || {}).length ? false : 'plus request #7 not applied yet' }, () => {
 const p = profile.pediaSources;
 for (const g of [...p.monsters.groups, p.monsters.itemsGroup, p.monsters.effectsGroup, ...p.items.groups, ...p.places.groups]) assert.ok(profile.daxGroups[g], g);
 assert.equal(p.monsters.recordSize, 'TChar'); assert.equal(p.items.catalogue.recordBytes * p.items.catalogue.recordCount + p.items.catalogue.headerBytes, 2050);
 assert.equal(p.spells.definitions.dsOffset, 0x37DA); assert.equal(p.spells.names.dsOffset, 0x27BD); assert.equal(p.items.nameWords.dsOffset, 0x1040);
});
test('Games selector: cab from the catalog, por listed (not startable here)', () => {
 assert.equal(PROFILE_URLS.length, 1); assert.match(PROFILE_URLS[0], /profiles\/cab\.json$/);
 assert.deepEqual(OTHER_GAMES.map(g => [g.id, g.supported]), [['por', false]]);
});
