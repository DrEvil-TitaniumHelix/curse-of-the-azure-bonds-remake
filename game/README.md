# game/ — Curse of the Azure Bonds v1.0, browser reproduction (engine API)

Fork of Pool's engine (`FORK.md`). Run: `python -I tools/serve.py 8189 --dev` → http://localhost:8189/index.html, or the
launcher `Play Curse of the Azure Bonds.cmd` (Desktop: `Remakes\Play Curse of the Azure Bonds.lnk`). Boot:
`index.html` → profile `profiles/cab.json` → `engine/main_cab.js` MainProgram (BYOC, input, DS image) →
`areas/startup.js` MainProgram 0000:002F. Dev routes (`engine/dev.js`): `?screen=S0nn` (freeze + `window.__screenReady`),
`?fast=n`, `?seed=n`, `?keys=...`, `?sting=1`, `?wooden=1`, `?wheel=1|retail` (default bypass, BUILD_PLAN §2a),
`?demo=1`, `?trace=1`. Headless shots: `node acceptance/shoot.mjs "S015?fast=4"`; compare: `node acceptance/cmp.mjs --pairs REF-S015=S015`.

Conventions: Curse Pascal parameter order; var parameters are `{ v }`; async where the original waits (keys, delays,
DAX loads). Globals: `G` (`engine/state.js`) with the names of `state/globals.json` (= decode/names, DS 0C1C; `G.g_XXXX`
aliases the named property); `G.ds` = the DS image (Uint8Array 8F00h, DS:0000 = image 0C1C0h) for image tables.

## Modules (who calls what)
| module | exports (Curse signatures) | decode |
|---|---|---|
| `engine/state.js` | `G`, `initState()`, `newChar()` (`b: Uint8Array(CHAR_SIZE=1A6h)`, `next, items, effects, combat`), `newItem()` (3Fh), `newEffect()` (9), `rdW/wrW`, `pstr/setPstr`, `charName`, `CHAR_SIZE/ITEM_SIZE/EFFECT_SIZE/COMBAT_SIZE` | engine request #2 |
| `engine/text.js` | `DrawText(col,row,fg,bg,s)`, `DrawRepeatedGlyph(col,row,fg,bg,count,ch,textMap)`, `ClearGlyphRun(col,row,colour,count)`, `ClearTextRectangle/ClearRectangle(x1,y1,x2,y2)`, `ClearScreen()`, `ClearMenuLine()`, `MessageDelay()`*, `ShowBottomPromptAndReadKey(fg,bg,s)`*, `ShowTimedBottomPrompt(s,fg,bg)`*, `DrawWrappedText(x1,y1,x2,y2,fg,bg,clear,s)`*, `ReadBottomLine(prompt,fg,bg,maxLen)`*, `ReadWordNumber(prompt,fg,bg)`*, `LoadTextFont()`*, `text` (cursor `text.col/row`); frames 01A0: `DrawScreenFrame()` 0000, `FrameWithBars3and8()` 00D3, `FrameExplore()` 0136, `FrameWithTextBar()` 0252, `FrameUpperRedraw()` 0292, `FrameCombat()` 0397, `FrameWithBar2()` 048D | RESIDENT res_0542, res_01A0 |
| `engine/pictures.js` | picture `{height, width8, count, x, y, cgaMap, frameSize, px (colour per pixel), mask (1 = transparent) }`; `LoadPicture(name,id,maskFlags,transp)`* → pic\|null, `AllocPicture(h,w8,count,flags)`, `FreePicture(pic)` → null, `PutPicture(col,row,pic)`, `GetPicture(col,row,pic)`, `DrawPictureInto(col,row,frame,flags,src,dst)`, `DrawPicture(col,row,frame,flags,src,dst)` (Curse clip/shear), `FillPictureRect(x,y,w,h,colour,cgaMap,pic)`, `FlushViewDirtyLines()`, `MirrorPicture(src,dst)`, `RecolorPicture(from[16],to[16],frame,randomMix,pic)`, `ConvertPicturePixels(src,ofs,maskFlags,transp,pic)`, `SetEgaPaletteRegister(i,c)`, `SetEgaPaletteRegisterRaw(i,v)`, `Load8x8Set(id,block)`*, `Put8x8Symbol(col,row,sym,toView,masked)`, `state` (`display`, `viewPic` = G.view_Pic, `saveBuf`, `symbolPic`, `SymbolSets`, `DataSet` = G.DataSet) | RESIDENT res_0297, VIEW ov35 |
| `engine/tiles_cab.js` | `tiles` (`set`, `set2`, `icons[slot] = [pose0, pose1]`), `Load24x24Set(name,id,start,count)`*, `DrawTile24(col,row,tile,flags)`, `LoadCombatIcon(name,id,slot)`*, `FreeCombatIcon(slot)`, `DrawIconAt(col,row,dir,pose,slot)` | VIEW ov33 |
| `engine/menus_cab.js` | `HorizontalMenu(prompt,options,promptColour,textColour,hotColour,allowExt,animate)`* → `{key, ext}`, `AskYesNo(prompt,c1,c2,c3)`*, `ClearMenuLine()`, `menu` (state in G.menu_*; hooks `animHook/animAdvance/forceAnim/clearForceAnim/cityAnim` installed by view_ov26.js). VerticalListMenu & lists: `areas/view_ov26.js` | VIEW ov26 |
| `engine/dax.js` | `LoadDaxRecord(name,ext,id)`* → Uint8Array\|null, `fetchFile(name)`*, `FileExists`*, `SetDataSet(n)`, `RestoreDataSet()`, `BiosPromptLine(colour,s)`* | RESIDENT res_0636 |
| `engine/input.js` | `ReadGameKey()`*, `KeyPressed()`, `FlushGameKeys()`*, `PollOneKey()`*, `ReadKey()`*, `waitKeyOrTimeout(ms)`*, `TerminateGame()`* (throws 'TerminateGame') | RESIDENT res_06EA |
| `engine/audio_cab.js` | `PlayOrStopSound(id)`* (0 stop, 1 on, FFh shutdown, 2..14 effect id-1), `StartSound()` | RESIDENT res_0713 |
| `engine/timer.js` | `TimeInHundredths()`, `Delay(ms)`*, `sleep`, `yieldShort` | |
| `engine/tp.js` | `Random(n)`, `randomReal()`, `Randomize()`, `setRandSeed`, `UpCase`, `ParamStr(n)`, `byte/word/shortint/integer`, `pstr` | RT_LEDGER |
| `engine/errors.js` | `fatal(msg, wait)` → throwable (text mode + message [+ key] + halt) | |
| `areas/engine_ov11.js` | `ov11_0056()` start-up (allocates `G.ecl_Mem4B00/7C00` Uint16Array(400h), `G.ecl_Mem7A00` (200h), `G.ecl_CodeBuf` Uint8Array(1E00h), `G.view_Pic`, `tiles.set`, sky pictures `G.sky_Moon/Sun/Strip`, ITEMS → `G.ItemTypeTable` = G.ds[5CF6..]); `ov11_06D8()` reset | ENGINE ov11 |
| `areas/engine_ov01.js` / `engine_ov03.js` | `ShowTitle()`, `ShowCredits()`, `WaitSecondsOrKey(s)` / `RuneWheelCheck(mode)` | ENGINE ov01/ov03 |
| `areas/startup.js` | `MainProgram(cfg)`, `StartupConfiguration(cfg)` | RESIDENT main_0000, res_020F |
| `engine/ecl_cab.js` | `EclVM` (VM core: decoder, memory map, 64 handlers, run/dispatch, gameLoop, runAfterNewBlock, campCheck), `SKIP_COUNT`, `OPCODE_NAMES` (ov34), `HOST_METHODS` (every non-VM routine it calls, by decode name) | ECL ov02, ov07 (VM half), ov34 |
| `areas/ecl_host.js` | `bindEclHost()` -> vm (host = engine routines + view_link X; calls `bindView({mem, setMem, setEclPC, eclPC, vecB})`), `ecl_GameLoop()`*, `ecl_CampCheck()`*, `ecl_RunAfterNewBlock()`*, `LoadEclBlock(n)`*, `ecl_InitVM()`, `ecl_GetMem(a)`, `ecl_SetMem(a, v)`* | ECL |
| `areas/engine_ov16.js` | `BuildCharacterFileList(names{v}, files{v})`*, `CheckSaveDisk`*, `LoadCharacterIcon`*, `DeleteCharacterFiles(c)`*, `WriteCharacter(c, fname)`*, `ReadCharacter(fname, c, unused, fromSaveDisk)`*, `ConvertPoolCharacter`, `ApplyHillsfarMinimums`, `LoadMonster(id, c)`*, `AddNpcToParty(id)`*, `AddToParty(c)`*, `LoadGame()`*, `SaveGame()`*, `MakeDosName`, `DeleteAll` | ENGINE ov16 |
| `areas/engine_ov17.js` (+ `_create.js`, `_edit.js`) | `PartyCreationMenu()`*, `CreateCharacter()`*, `ConHpAdj`, `ConHpBonus`, `MinHitPoints`, `MaxHitPoints`, `RollHitDice`, `PayGold`, `TrainCharacter()`*, `FreeCharacter(c{v})`, `RemovePartyMember(keepCount, freeIcon)`*, `DropCharacterForever()`*, `ModifyCharacter()`*, `AddCharacterMenu()`*, `IconEditor()`* | ENGINE ov17 |

`*` = async. Optional bindings the start-up looks for (cab-build-areas): `areas/magic_ov22.js InitSpellTable`,
`areas/party_ov12.js InstallEffectHandlers`, `areas/view_ov30.js SetBackdropColours`. Seeds for acceptance: the DOSBox reference runs were seeded by the DOS clock;
the camp/main runs = `?seed=169084438` (06:22:10.20, found from REF-S016 + the record id byte), rune-wheel only = `?seed=4444`.
