// game/areas/view_link.js — late binding of routines across the area files (as Pool's ov14 `X` proxy).
// Owner: cab-build-areas. An area routine that calls into another unit by its published name (decode/names/*.json)
// uses `X.Name(...)`: the first module in AREA_MODULES that exports `Name` supplies it. Modules that do not exist yet
// are skipped, so a unit can be built and tested before its callees; an unbound name warns once and returns 0.
// `await X.ready()` resolves the bindings; `bind({ Name: fn })` overrides (tests, other lanes).

const AREA_MODULES = [
  './view_ov10.js', './view_ov14.js', './view_ov26.js', './view_ov27.js', './view_ov28.js', './view_ov29.js', './view_ov30.js',
  './view_ov31.js', './view_ov32.js', './view_ov33.js', './view_ov35.js',
  './party_ov06.js', './party_ov12.js', './party_ov20.js', './party_ov21.js', './party_ov24.js', './party_ov25.js',
  './magic_ov04.js', './magic_ov08.js', './magic_ov15.js', './magic_ov22.js',
  './combat_ov05.js', './combat_ov07.js', './combat_ov09.js', './combat_ov13.js', './combat_ov18.js', './combat_ov19.js', './combat_ov23.js',
  // cab-build-engine's units (ENGINE ov16/ov17, ECL host)
  './engine_ov16.js', './engine_ov17.js', './ecl_host.js',
  '../engine/audio_cab.js', '../engine/text.js', '../engine/menus_cab.js',   // the Curse adapters; not Pool's audio.js / menus.js: Pool's menus (ListItem(n, list)); view_ov26.js has the Curse ones
];

const fns = {};
let loading = null;
const warned = new Set();

export function bind(more = {}) { Object.assign(fns, more); }

async function load() {
  if (!loading) loading = (async () => {
    for (const m of AREA_MODULES) {
      try {
        const mod = await import(m);
        for (const [k, v] of Object.entries(mod)) if (typeof v === 'function' && !(k in fns)) fns[k] = v;
      } catch (e) {
        if (!(e instanceof TypeError) && !/Failed to fetch|Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(e))) console.warn('view_link: ' + m, e);
      }
    }
  })();
  return loading;
}

export const X = new Proxy({}, {
  get(_, name) {
    if (name === 'ready') return load;
    if (name === 'then') return undefined;                // not a thenable
    return async (...a) => {
      if (typeof fns[name] !== 'function') await load();
      if (typeof fns[name] === 'function') return fns[name](...a);
      if (!warned.has(name)) { warned.add(name); console.warn('view_link: ' + String(name) + ' not bound yet'); }
      return 0;
    };
  },
});
