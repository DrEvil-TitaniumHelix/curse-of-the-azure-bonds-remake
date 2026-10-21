// game/plus/click/title.js — Gold Box Plus W3: the title and credits screens (SU-03 / SU-04 / SU-05) by mouse.
// Owner: gbp-click.
//
// These screens wait a few seconds or for any key (WaitSecondsOrKey 2500:0000, the lightning loop 2500:06fd; the key is
// not consumed, 0899:0104). While one waits (event anyKeyWait) the whole picture is a Plus region: left click = Space
// (the key a player presses to go on), right click = Continue (Space) / Continue (Enter) / Esc. The code-wheel screen
// (SU-06) reads its answer through ReadBottomLine, so the line-input field of click/input.js covers it.
import { hooks } from '../hooks.js';
import { KEY } from '../../engine/input.js';

const SPACE = [32, 0x39];
const NAME = { 'SU-03': 'title', 'SU-04': 'title', 'SU-05': 'credits' };

export function mountTitle() {
  hooks.on('anyKeyWait', (p) => {
    const what = NAME[p.screen] || 'screen';
    hooks.registerRegion({ id: 'plus-anykey', scope: 'anykey', kind: 'anykey', prio: 0,
      rect: { x1: 0, y1: 0, x2: 319, y2: 199 },
      left: [SPACE],
      right: [{ label: `Continue past the ${what} (Space)`, keys: [SPACE], default: true },
        { label: 'Continue (Enter)', keys: [KEY.enter] }, { label: 'Esc', keys: [KEY.esc] }] });
  });
  hooks.on('anyKeyWaitEnded', () => hooks.clearRegions('anykey'));
}
