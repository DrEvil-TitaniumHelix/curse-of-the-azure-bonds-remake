# Pool-specific implementation boundaries

Marker requests for gbp-hooks. Line numbers are this lane's snapshot; use the description/identifier when concurrent hooks edits move them. Put `// por-only` at each listed boundary. A module-level marker covers the translated routines and embedded DS offsets throughout that module; it is not a request to annotate thousands of individual byte reads. Generic DAX/RLE decoding, EXEPACK decoding, EGA rendering, BIOS font data and timer utilities remain reusable.

Fields named below are real fields in por.json. `engine.id` selects the complete decoded Pool adapter for rules/DS layouts that cannot safely be parameterized as a few numbers. These remain Pool code until a sequel is independently decoded; no claim of a generic engine is made.

| File:line | Pool-specific boundary | Profile replacement / selector |
|---|---|---|
| `game/engine/main.js:20` | POOL.CFG paths and default configuration | `engine.configuration` |
| `game/engine/main.js:15` | Pool startup/party entry adapter | `engine.entryModule / engine.entryExport` |
| `game/engine/byoc.js:26` | Pool import database and accepted save names | `engine.storage.data / saveFormat` |
| `game/engine/byoc.js:62` | Fixed v1.3 BYOC manifest | `manifest.url` |
| `game/engine/byoc.js:174` | Character, item/effect and SAVGAM size validation | `recordSizes / saveFormat.gameBytes` |
| `game/engine/state.js:68` | Pool globals JSON, executable and DS image offsets | `engine.state` |
| `game/engine/state.js:82` | Pool character/item/effect/combat record allocations | `recordSizes` |
| `game/engine/ecl.js:15` | Record sizes and VM base/code buffer | `recordSizes / ecl` |
| `game/engine/ecl.js:19` | Pool DS globals and VM memory layout | `engine.id (decoded adapter) / engine.state.globals` |
| `game/engine/ecl.js:1492` | Pool opcode skip/dispatch tables and handlers | `ecl.opcodeTableVersion / ecl.implementation` |
| `game/engine/text.js:23` | Font archive and record 201 | `engine.font` |
| `game/engine/files.js:19` | Save database | `engine.storage.saves` |
| `game/engine/files.js:128` | Aâ€“J slot names and eight member files | `saveFormat` |
| `game/engine/pictures.js:25` | 168-line Pool view buffer and span geometry | `engine.id (decoded adapter)` |
| `game/engine/pictures.js:263` | Pool picture-symbol tile bases | `engine.id (decoded adapter) / daxGroups` |
| `game/engine/dax.js:83` | Pool disk-prompt DS table 2614, dataset suffix and path policy | `engine.id (decoded adapter) / daxGroups` |
| `game/engine/audio.js:1` | Pool sound-driver image offsets and PIT driver translation | `engine.id (decoded adapter)` |
| `game/engine/input.js:1` | Pool BIOS reader semantics, STING controls and pointer menu mappings | `engine.id (decoded adapter)` |
| `game/engine/menus.js:1` | Pool menu geometry, highlighting and key semantics | `engine.id (decoded adapter)` |
| `game/engine/dev.js:1` | Pool title/code-wheel/party/explore test routes | `engine.id (decoded adapter)` |
| `game/areas/combat.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_core.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov05.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov09.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov13.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov18.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov19.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/combat_ov24.js:1` | Pool combat fields, monster/icon loading, terrain and AD&D rules (whole module) | `engine.areaModules / recordSizes / daxGroups` |
| `game/areas/ecl_host.js:1` | Pool VM bindings, initial globals and SAVGAM offsets (whole module) | `engine.areaModules / ecl / saveFormat` |
| `game/areas/flow.js:1` | Pool translated resident helpers/control flow, DS offsets and record fields (whole module) | `engine.areaModules / engine.state / recordSizes` |
| `game/areas/magic.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_core.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_ov04.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_ov08.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_ov15.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_ov22.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/magic_spells.js:1` | Pool spell ids, tables, dispatch, class limits and magic rules (whole module) | `engine.areaModules / pediaSources.spells` |
| `game/areas/party.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_core.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov06.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov12.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov16a.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov16b.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov17.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov20.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/party_ov21.js:1` | Pool character/party creation, roster, save layouts, shops and training rules (whole module) | `engine.areaModules / recordSizes / saveFormat` |
| `game/areas/res_00ba.js:1` | Pool translated resident helpers/control flow, DS offsets and record fields (whole module) | `engine.areaModules / engine.state / recordSizes` |
| `game/areas/res_00ba_core.js:1` | Pool translated resident helpers/control flow, DS offsets and record fields (whole module) | `engine.areaModules / engine.state / recordSizes` |
| `game/areas/res_00ba_u.js:1` | Pool translated resident helpers/control flow, DS offsets and record fields (whole module) | `engine.areaModules / engine.state / recordSizes` |
| `game/areas/res_00ba_v.js:1` | Pool translated resident helpers/control flow, DS offsets and record fields (whole module) | `engine.areaModules / engine.state / recordSizes` |
| `game/areas/startup.js:1` | Pool title/credits/code wheel, startup globals, ITEMS loader and initial party flow (whole module) | `engine.areaModules / manifest / pediaSources.items / engine.font` |
| `game/areas/testparty.js:1` | Pool test-party names, classes, records, starting Phlan position and save writer (whole module) | `engine.areaModules / saveFormat / recordSizes / areas` |
| `game/areas/view.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov10.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov14.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov23.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov28.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov30.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov31.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |
| `game/areas/view_ov32.js:1` | Pool GEO/wall/picture layouts, asset names and travel rendering (whole module) | `engine.areaModules / daxGroups / areas` |

Boot request: choose a profile before BYOC import/`initState`, resolve its manifest URL, call `byoc.setManifest`, retain `profile.id` for Plus storage, and load the declared Pool adapter. See README.md. The selector itself is side-effect-free until called. Register its Games renderer after mounting Plus. Preserve existing automated routes by explicitly selecting `por` in their boot path; unknown ids must fail visibly.
