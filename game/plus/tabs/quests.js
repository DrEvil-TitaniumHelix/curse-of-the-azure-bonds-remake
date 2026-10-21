// Quests tab (W5, gbp-flags; cab-ecl-quests: Curse wording): the quests the party has met, with their status, re-rendered on every quest change
// (inside the hooks event that caused it). Names and descriptions are the game's own texts from the imported files.
import { questTracker } from '../quests/quests.js';
import { QUESTS, GROUPS, refKey } from '../quests/table.js';

export const STATUS_LABELS = Object.freeze({
  offered: 'Offered', accepted: 'Accepted', progress: 'In progress', done: 'Done',   // cab: no clerk pays in Curse
  rewarded: 'Rewarded', failed: 'Failed', closed: 'Finished',
});

const clean = (t) => t.replace(/^'+|'+$/g, '').replace(/\s+/g, ' ').trim();
export function questText(q, texts) {
  const refs = q.offer ? [q.offer] : q.title ? (Array.isArray(q.title[0]) ? q.title : [q.title]) : [];
  const parts = refs.map((r) => texts.get(refKey(r)));
  return parts.length && parts.every(Boolean) ? clean(parts.join('')) : null;
}

export function renderQuests(container, { log, slot, original = false, table = QUESTS } = {}) {
  container.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'Quests'; container.append(heading);
  if (original) { const p = document.createElement('p'); p.textContent = 'Quests are off in original-game mode.'; container.append(p); return; }
  const met = log.list().filter((q) => q.met);
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  status.textContent = met.length ? `${met.length} quest${met.length === 1 ? '' : 's'} met${slot && slot !== 'unsaved' ? ` (saved game ${slot})` : ''}.` : 'No quests met yet. A quest appears here once the game offers it or records progress on it.';
  container.append(status);
  if (!log.texts.size) { const p = document.createElement('p'); p.textContent = 'Quest texts appear once your imported game files are readable.'; container.append(p); }
  for (const [group, label] of Object.entries(GROUPS)) {
    const rows = met.filter((q) => q.group === group);
    if (!rows.length) continue;
    const h = document.createElement('h3'); h.textContent = label; container.append(h);
    const ul = document.createElement('ul'); ul.dataset.group = group;
    for (const q of rows) {
      const li = document.createElement('li'); li.dataset.quest = q.id; li.dataset.status = q.status;
      const badge = document.createElement('strong'); badge.textContent = STATUS_LABELS[q.status] || q.status;
      const text = document.createElement('span');
      text.textContent = ' — ' + (questText(table[q.key], log.texts) || `Quest record ${q.key.toString(16).toUpperCase()} (text unavailable)`);
      li.append(badge, text);
      if (q.progress && q.status === 'progress') li.append(document.createTextNode(` (${q.progress.count} of ${q.progress.of})`));
      if (q.conf !== 'H') { const small = document.createElement('small'); small.textContent = ' Status partly inferred from the decoded scripts.'; li.append(small); }
      ul.append(li);
    }
    container.append(ul);
  }
}

export function registerQuestsTab(plus, { tracker } = {}) {
  tracker ||= questTracker();
  let current = null;
  const draw = () => renderQuests(current, { log: tracker.log, slot: tracker.slot, original: plus.settings.original });
  plus.registerTab('quests', (container) => { current = container; draw(); });
  tracker.onChange(() => { if (current?.isConnected && current.getAttribute('aria-labelledby') === 'por-plus-tab-quests') draw(); });
  tracker.ready.then(() => { if (current?.isConnected && current.getAttribute('aria-labelledby') === 'por-plus-tab-quests') draw(); }).catch(() => {});
  return tracker;
}
