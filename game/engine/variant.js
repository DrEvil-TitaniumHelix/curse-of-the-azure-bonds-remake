// variant.js — the game-version behaviour switch (cab: v13-3; decode/V13_DELTA.md 3.4).
// `variant.id` is the profile's engine.behaviour.id ('cab-1.0' for the owner's v1.0 copy, 'cab-1.3' for the WizardWorks CD).
// Every v1.3-only line in game/ tests `variant.is13`; v1.0 keeps the accepted behaviour unchanged. Set once by main_cab.js
// after the BYOC import decided which manifest the player's files match (v13-4); tests set it directly.
export const variant = {
  id: 'cab-1.0',
  get is13() { return this.id === 'cab-1.3'; },
  set(id) { this.id = id || 'cab-1.0'; return this.id; },
};
