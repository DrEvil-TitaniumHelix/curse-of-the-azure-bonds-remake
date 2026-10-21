import { renderKeys } from './keys.js';
import { renderStatus } from './status.js';
// Pool's full tab row (kept: the feature packages register their pages under these ids)
export const poolTabs = [
 ['status', 'Status'], ['quests', 'Quests'], ['journal', 'Journal'], ['pedia', 'Pedia'], ['map', 'Map'],
 ['map', 'Map'], ['helpers', 'Helpers'], ['mods', 'Mods'], ['keys', 'Keys'],
 ['cheats', 'Cheats (dev)'], ['scenario', 'Scenario'], ['games', 'Games'], ['about', 'About/Credits'],
];
// cab: param — Curse S2 shows only the pages adapted so far; a package adds its id here when it starts (S3..S6)
export const tabs = [['status', 'Status'], ['quests', 'Quests'], ['journal', 'Journal'], ['pedia', 'Pedia'], ['map', 'Map'], ['helpers', 'Helpers'], ['keys', 'Keys'], ['cheats', 'Cheats (dev)'], ['scenario', 'Scenario (dev)'], ['games', 'Games'], ['about', 'About/Credits']];   // cheats / scenario: dev only (S7)
export function renderStub(container, id) {
 if (id === 'keys') return renderKeys(container);
 if (id === 'status') return renderStatus(container, globalThis.goldBoxPlus);
 const p = document.createElement('p');
 p.textContent = `${poolTabs.find(t => t[0] === id)?.[1] || id}: this page is being built.`;
 container.append(p);
}
