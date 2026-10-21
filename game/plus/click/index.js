// game/plus/click/index.js — Gold Box Plus W3 entry: mount the click layer and its screen providers (gbp-click).
// Boot (gbp-integrate): `(await import('./plus/click/index.js')).mountClickLayer({ canvas })` after the game canvas exists.
// cab: param — `profile`: Curse ('cab') mounts the generic layer (click.js right-click lists over the engine's bottom menu,
// list and 3D-view regions; input.js line prompts; title.js any-key waits) with its own providers (cab.js: roster,
// area-map travel); Pool's travel / combat providers read Pool's area modules and are mounted only for 'por'.
import { mountClick } from './click.js';
import { mountTravel } from './travel.js';
import { mountCombat } from './combat.js';
import { mountInput } from './input.js';
import { mountTitle } from './title.js';
import { mountCab } from './cab.js';
import { configureCombat } from './combat.js';

let mounted = false;
export function mountClickLayer({ canvas = document.getElementById('screen'), profile = 'por' } = {}) {
  const c = mountClick({ canvas });
  if (!mounted) {
    mounted = true;
    if (profile === 'cab') {                                       // cab: param
      configureCombat({ module: '../../areas/view_ov32.js', costTable: 0x26A2 });   // CellAt 7000:0509, CombatTerrain DS:26A2
      mountInput(); mountTitle(); mountCab(); mountCombat();
    }
    else { mountTravel(); mountCombat(); mountInput(); mountTitle(); }
  }
  return c;
}
export { travelTo, path, overlandTravelTo, overlandPath } from './travel.js';
