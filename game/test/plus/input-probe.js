// game/test/plus/input-probe.js — GBP W3 #q-9 headless helpers for line-input prompts (Create Character name).
import { input } from '../../plus/click/input.js';
import { script } from '../../engine/input.js';
import { hooks } from '../../plus/hooks.js';

const drained = async () => { for (let t = 0; t < 200 && script.keys.length; t++) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 400)); };
const visible = () => [...document.querySelectorAll('input,textarea,[contenteditable=true]')].filter((e) => e.getClientRects().length);

export function state() {
  return { active: input.active && { kind: input.active.kind, prompt: input.active.prompt, maxLen: input.active.maxLen },
    value: input.field?.value ?? null, focused: document.activeElement === input.field, visibleTextInputs: visible().length,
    regions: hooks.regions().map((r) => r.id) };
}
// type into the field as a player would (keydown per character), wait until the game has taken the keys
export async function typeInField(text) {
  const f = input.field; if (!f) throw new Error('no field');
  f.focus();
  for (const ch of text) f.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
  await drained();
  return state();
}
export { drained };
