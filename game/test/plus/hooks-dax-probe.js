// game/test/plus/hooks-dax-probe.js — GBP hooks request #6: the mods resolver behind engine/dax.js LoadDaxRecord.
// Loaded in the page by hooks-dax-run.json (GBP-HOOKS-DAX); returns what was checked, throws on a failure.
import { hooks } from '../../plus/hooks.js';
import * as dax from '../../engine/dax.js';

const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

export async function run() {
  const { plusMods, installSample } = await import('../../plus/mods/manager.js');
  const { mountPlus } = await import('../../plus/plus.js');
  const plus = mountPlus(); await plus.ready; await plus.setSetting('original', false);
  await installSample();
  const other = dax.readDir(await dax.fetchFile('PIC1.DAX')).entries[0].id;   // PIC3 holds only the skinned 1, 29, 41
  const load = (id) => dax.LoadDaxRecord('PIC3', '.dax', id), loadOther = () => dax.LoadDaxRecord('PIC1', '.dax', other);
  const r = {};
  hooks.setDaxResolver(null);
  const orig = await load(1), origOther = await loadOther();
  if (!orig || !origOther) throw new Error('PIC3 records missing: ' + !!orig + ' ' + !!origOther);
  hooks.setDaxResolver(plusMods.resolve);
  r.noModEnabledSame = same(await load(1), orig);
  await plusMods.enable('sample-recolour', true);
  const on = await load(1);
  r.skinDiffers = !same(on, orig);
  r.skinSameSize = on.length === orig.length;
  r.untargetedSame = same(await loadOther(), origOther);
  hooks.enabled = false;
  r.masterOffSame = same(await load(1), orig);
  hooks.enabled = true;
  await plusMods.enable('sample-recolour', false);
  r.skinOffSame = same(await load(1), orig);
  hooks.setDaxResolver(null);
  const bad = Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) throw new Error('failed: ' + bad.join(', '));
  return { other, ...r };
}
