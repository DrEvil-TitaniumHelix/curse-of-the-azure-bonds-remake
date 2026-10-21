// engine_ov16.js — ENGINE ov16 (4300): character files, import (Curse / Pool / Hillsfar), save and load game.
// Translation of CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov16, re-read against decode/listings/ov16.lst where the
// pseudocode summarises (ScanCharFiles' name filter, LoadCharacterIcon, ConvertPoolCharacter, ApplyHillsfarMinimums,
// ReadCharacter's item / effect files, LoadMonster, AddToParty, LoadGame's tail). Pool twin: Pool ov17 (7500),
// PoolRadianceRE game/areas/party_ov17.js (structure). Formats: decode/data/SAVES.md.
//
// - Files go through engine/files.js (the browser save store = SavePath; names are upper-cased base names). The DOS
//   error paths of CheckSaveDisk / WriteCharacter / SaveGame (volume label, MkDir, IOResult) cannot occur there: their
//   loops are kept with the error code fixed at 0, DiskFree is a large constant.
// - Character records { b: Uint8Array(1A6h), next (+189h), items (+14Dh), effects (+F2h), combat (+18Dh) }. The four far
//   pointers inside `b` are written as the in-memory bytes (zeros in this build; DOSBox saves carry stale values there).
// - Menu list nodes (TMenuItem, 2Eh bytes): { text, isHeader, next } (areas/view_ov26.js).
// - Wall-set slots i = 1..3 (DS:7210+4i id / DS:7212+4i slot) live in areas/view_ov30.js view.wallSlotId / wallSlotNo.

import { G, newChar, newItem, newEffect, pstr, setPstr } from '../engine/state.js';
import { readFile, writeFile, eraseFile, fileExists, listStore, baseName } from '../engine/files.js';
import { LoadDaxRecord, SetDataSet, RestoreDataSet } from '../engine/dax.js';
import { DrawText, ShowBottomPromptAndReadKey, ReadBottomLine, ClearMenuLine } from '../engine/text.js';
import { HorizontalMenu, AskYesNo } from '../engine/menus_cab.js';
import { FlushGameKeys, TerminateGame } from '../engine/input.js';
import { UpCase } from '../engine/tp.js';
import { RecolorPicture } from '../engine/pictures.js';
import { tiles, LoadCombatIcon, FreeCombatIcon } from '../engine/tiles_cab.js';
import { view } from './view_ov30.js';
import { X } from './view_link.js';
import { dev } from '../engine/dev.js';
import { variant } from '../engine/variant.js';            // cab: v13-3
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md): emit only

const SavePath = () => G.SavePath ?? '';                // DS:5BF0 (curse.cfg line 3)
const SaveDrive = () => SavePath()[0] ?? 'C';           // SaveDrive DS:5BF1 = SavePath[1]
const dsb = (o) => (G.ds ? G.ds[o] : 0);
const dsw = (o) => (G.ds ? G.ds[o] | (G.ds[o + 1] << 8) : 0);
const dsPstr = (o) => { let s = ''; for (let i = 1; i <= dsb(o); i++) s += String.fromCharCode(dsb(o + i)); return s; };
const DISK_FREE = 0x7FFFFFFF;                           // Dos.DiskFree: the browser store has room
const sx16 = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;
const m4B = (ofs) => G.ecl_Mem4B00[ofs >> 1];          // byte offset of a word region (ECL_VM.md §2)
const m7C = (ofs) => G.ecl_Mem7C00[ofs >> 1];
const setM7C = (ofs, v) => { G.ecl_Mem7C00[ofs >> 1] = v & 0xFFFF; };
const lowByte = (arr, ofs) => (ofs & 1 ? arr[ofs >> 1] >> 8 : arr[ofs >> 1] & 0xFF);   // .b[ofs] of a word array

// DS tables of the import sources (ENGINE.pas.md ov16 header): name offset, flag-byte offset, file size per ImportSource
const ImportNameOfs = (s) => dsb(0x0506 + s);          // 0 / 0 / 4
const ImportFlagOfs = (s) => dsw(0x0509 + 2 * s);      // F7h / 84h / 13h
const ImportFileSize = (s) => dsw(0x050F + 2 * s);     // 1A6h / 11Dh / BCh

// ---- resident 0636 name helpers (RESIDENT.pas.md) --------------------------------------------------------------------

// 0636:0549 DeleteAll(s, sub) — quirk: the bound is computed once and i still advances after a deletion, so two adjacent
// occurrences leave the second one
export function DeleteAll(s, sub) {
  let a = s;
  const n = (a.length - sub.length + 1) & 0xFF;                           // 0636:0578
  for (let i = 1; i <= n; i++)                                            // 0636:059d
    if (a.substr(i - 1, sub.length) === sub) a = a.slice(0, i - 1) + a.slice(i - 1 + sub.length);   // 0636:05af
  return a;
}

// 0636:0618 MakeDosName(s): remove g_0C97[1..10] = ' . * , ? / \ : ; |', first 8 characters, upper case
export function MakeDosName(s) {
  let a = s;
  for (let i = 1; i <= 10; i++) a = DeleteAll(a, String.fromCharCode(dsb(0x0C97 + i) || ' .*,?/\\:;|'.charCodeAt(i - 1)));   // 0636:063e
  a = a.slice(0, 8);                                                      // 0636:067c
  return a.split('').map(UpCase).join('');                                // 0636:06a4
}

// 0636:0192 DeleteFileIfExists(name)
async function DeleteFileIfExists(name) { if (await fileExists(name)) await eraseFile(name); }

const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const listCount = (p) => { let n = 0; for (; p; p = p.next) n++; return n; };

// =====================================================================================================================

// 4300:0000 ov16_0000 — pre-load overlay units (overlay manager only)
export function ov16_0000() {}

// 4300:0020 CStringToPascal(src, var dst): bytes up to the 0 terminator (the Hillsfar name, record +4)
export function CStringToPascal(src, ofs, dst) {
  let s = '';
  for (let i = ofs; i < src.length && src[i] !== 0 && s.length < 255; i++) s += String.fromCharCode(src[i]);   // 4300:0026
  dst.v = s;
}

// 4300:008D ScanCharFiles(pattern, nameOfs, flagOfs, fileSize, var names, var files) — nested in BuildCharacterFileList
async function ScanCharFiles(pattern, nameOfs, flagOfs, fileSize, names, files, tails) {
  const ext = pattern.slice(1).toUpperCase();                            // '*.guy' -> '.GUY'
  const found = (await listStore()).filter((f) => f.name.endsWith(ext));  // 4300:00c5  FindFirst(SavePath + pattern, 0)
  for (const sr of found) {                                               // 4300:00ca / 042d  FindNext
    const b = sr.bytes;
    if (b.length !== fileSize) continue;                                  // 4300:010e .. 0125  FileSize(f) = fileSize
    let nameEntry = { text: '', isHeader: 0, next: null };                // 4300:012a .. 0163  GetMem + FillChar 2Eh
    let fileEntry = { text: '', isHeader: 0, next: null };
    if (G.ImportSource === 2) {                                           // 4300:017a  Hillsfar: C string
      const nm = { v: '' }; CStringToPascal(b.subarray(nameOfs, nameOfs + 0x10), 0, nm);   // 4300:0197 / 01a9
      nameEntry.text = nm.v.substring(0, 40);                             // 4300:01b5
    } else nameEntry.text = pstr(b.subarray(nameOfs, nameOfs + 0x10), 0); // 4300:01d1  BlockRead 16 bytes (string[15])
    const flag = G.ImportSource === 2 ? 0 : b[flagOfs];                   // 4300:01e8 .. 020a
    fileEntry.text = sr.name.substring(0, 40);                            // 4300:021d  sr.Name
    const suffix = sr.name.substr(8, 4) === '.SAV' ? 'from saved game ' + sr.name[6] : '';   // 4300:0235 .. 027b
    const pad = (s) => dsPstr(0x04F6).substr(0, Math.max(0, 15 - s.length));   // DS:04F6 = 15 spaces
    nameEntry.text = (nameEntry.text + pad(nameEntry.text) + suffix).substring(0, 40);   // 4300:02af .. 02cd
    let p = G.PartyList;                                                  // 4300:02d2
    while (p && nameEntry.text.substr(0, 15) !== pstr(p.b, 0) + pad(pstr(p.b, 0))) p = p.next;   // 4300:02f9 .. 034e
    if (flag > 0x7F || p) { nameEntry = null; fileEntry = null; }         // 4300:0350 .. 0388  hidden / already in the party
    if (!nameEntry) continue;                                             // 4300:038b
    if (!names.v) { names.v = nameEntry; files.v = fileEntry; tails.n = nameEntry; tails.f = fileEntry; }   // 4300:0396 .. 03dc
    else { tails.n.next = nameEntry; tails.n = nameEntry; tails.f.next = fileEntry; tails.f = fileEntry; }   // 4300:03de .. 0419
  }
}

// 4300:0453 BuildCharacterFileList(var names, var files)
export async function BuildCharacterFileList(names, files) {
  names.v = null; files.v = null;                                         // 4300:045a / 0466
  if (!(await CheckSaveDisk())) return false;                             // 4300:0473
  const s = G.ImportSource ?? 0, tails = {};
  if (s === 0) await ScanCharFiles('*.guy', ImportNameOfs(0), ImportFlagOfs(0), ImportFileSize(0), names, files, tails);   // 4300:04cf
  else if (s === 1) {
    await ScanCharFiles('*.cha', ImportNameOfs(1), ImportFlagOfs(1), ImportFileSize(1), names, files, tails);   // 4300:0527
    await ScanCharFiles('*.sav', ImportNameOfs(1), ImportFlagOfs(1), dsw(0x0511), names, files, tails);          // 4300:056d  g_0511
  } else if (s === 2) await ScanCharFiles('*.hil', ImportNameOfs(2), ImportFlagOfs(2), ImportFileSize(2), names, files, tails);   // 4300:05c1
  return true;
}

// 4300:0643 CheckSaveDisk: the volume label is never 'CURSE' and the save directory always exists in the store
export async function CheckSaveDisk() {
  let err = 0;
  if ((G.ImportSource ?? 0) === 0) {
    do {
      // 4300:0658 .. 0685  while (GetVolumeLabel(SaveDrive) = 'CURSE') and (SaveDrive < 'C') do "Put save disk in": never here
      do {
        err = 0;                                                          // 4300:06c0 / 06e9  FindFirst(SavePath, Directory)
        if (err === 0) break;                                             // 4300:06f2
        if (err === 2 || err === 0x12) { /* MkDir */ }                    // 4300:06fa .. 07b5
        else if (UpCase(SaveDrive()) < 'C') await ShowBottomPromptAndReadKey(0x0E, 0, 'Put save disk in ' + SaveDrive() + ':');   // 4300:07ca
        else { await ShowBottomPromptAndReadKey(0x0E, 0, 'Unexpected error during save: ' + err); return false; }   // 4300:0805 / 0834
      } while (!(err === 0 || err === 5));                                // 4300:0837
    } while (!(err === 0 || err === 5));                                  // 4300:084a
  } else {
    do { err = 0; } while (err !== 0);                                    // 4300:0867 .. 0916  the import directory = the store
  }
  return true;                                                            // 4300:09e0
}

// 4300:09EB OverlayIconPicture(src, dst): head icon onto body icon — data OR, mask AND over src's frame size
export function OverlayIconPicture(src, dst) {
  if (!src || !dst) return;
  const n = src.height * src.width8 * 8;                                  // 4300:09f4  frameSize - 1 (in bytes; pixels here)
  for (let i = 0; i < n && i < dst.px.length; i++) {                      // 4300:0a03
    dst.px[i] |= src.px[i];                                               // 4300:0a23  data OR (transparent pixels are 0)
    if (dst.mask && src.mask) dst.mask[i] &= src.mask[i];                 // 4300:0a51  mask AND (1 = transparent)
  }
}

// 4300:0A7E LoadCharacterIcon(recolour): the two combat-icon poses of SelectedChar in its icon slot (+143h)
export async function LoadCharacterIcon(recolour) {
  SetDataSet(1);                                                          // 4300:0a88
  const c = G.SelectedChar;                                               // 4300:0a8d
  const letter = String.fromCharCode(dsb(0x0515 + c.b[0x144]));          // 4300:0ab9  DS:0515[icon size]: 1 'S', 2 'T'
  await LoadCombatIcon('CHEAD' + letter, c.b[0x141], 11);                 // 4300:0ad4  icon head -> slot 11
  await LoadCombatIcon('CBODY' + letter, c.b[0x142], c.b[0x143]);        // 4300:0b1c  icon body -> the character's slot
  const s11 = tiles.icons[11] || [], sc = tiles.icons[c.b[0x143]] || [];
  OverlayIconPicture(s11[0], sc[0]);                                      // 4300:0b42
  OverlayIconPicture(s11[1], sc[1]);                                      // 4300:0b66
  if (recolour) {                                                         // 4300:0b69
    const from = [], to = [];
    for (let k = 0; k <= 15; k++) { from[k] = k; to[k] = k; }             // 4300:0b72 .. 0b99
    for (let i = 1; i <= 6; i++) {                                        // 4300:0b9b
      to[dsb(0x3EC0 + i)] = c.b[0x144 + i] & 0x0F;                        // 4300:0bc6  DS:3EC0+i = 1 2 3 4 6 7
      to[dsb(0x3EC0 + i) + 8] = c.b[0x144 + i] >> 4;                      // 4300:0bf5
    }
    RecolorPicture(from, to, 0, 0, sc[0]);                                // 4300:0c26
    RecolorPicture(from, to, 0, 0, sc[1]);                                // 4300:0c53
  }
  FreeCombatIcon(11);                                                     // 4300:0c5b
  RestoreDataSet();                                                       // 4300:0c60
  await FlushGameKeys();                                                  // 4300:0c65
}

// 4300:0C7E DeleteCharacterFiles(var ch): <name>.guy / .swg / .fx
export async function DeleteCharacterFiles(c) {
  const base = SavePath() + MakeDosName(pstr(c.b, 0));                    // 4300:0c85 .. 0cb3
  await DeleteFileIfExists(base + '.guy');                                // 4300:0cd2
  await DeleteFileIfExists(base + '.swg');                                // 4300:0cf1
  await DeleteFileIfExists(base + '.fx');                                 // 4300:0d10
}

// 4300:0DEA WriteCharacter(var ch, fname): fname = '' -> <name>.guy (stand-alone), else <fname>.sav (saved-game member)
export async function WriteCharacter(c, fname) {
  G.ImportSource = 0;                                                     // 4300:0e04
  let choice;
  do {
    if (!(await CheckSaveDisk())) return;                                 // 4300:0e09
    const need = 0x1A6 + 0x3F * listCount(c.items) + 9 * listCount(c.effects);   // 4300:0e14 .. 0ea6
    choice = 'O';                                                         // 4300:0ea8
    if (DISK_FREE < need) {                                               // 4300:0ead
      await ShowBottomPromptAndReadKey(0x0E, 0, "Can't save.  No room on this disk.");   // 4300:0ed5
      choice = (await HorizontalMenu('Lose character? ', 'Ok  Try another disk', 0x0D, 0x0A, 0x0F, false, false)).key;   // 4300:0ef0
    }
  } while (choice !== 'O');                                               // 4300:0f2e  quirk: Ok writes to the full disk anyway
  let name, ext;
  if (fname === '') { name = MakeDosName(DeleteAll(pstr(c.b, 0), '.')); ext = '.guy'; }   // 4300:0f38 .. 0f78
  else { ext = '.sav'; name = fname.substring(0, 40); }                   // 4300:0f8e / 0fa7
  // 4300:0fb6 .. 1097  Assign / Reset / DosError in [0, 2] (cannot fail in the store); 4300:10a8 Close
  choice = 'N';                                                           // 4300:10b3
  while (choice === 'N' && fname === '' && await fileExists(SavePath() + name + ext)) {   // 4300:10b8 .. 10f1
    choice = await AskYesNo('Overwrite ' + name + '? ', 0x0E, 0x0A, 0x0F);   // 4300:1122
    if (choice === 'N') {
      name = '';                                                          // 4300:113b
      while (name === '') name = await ReadBottomLine('New file name: ', 0x0A, 0, 8);   // 4300:1140 / 1147
    }
  }
  await writeFile(SavePath() + name + ext, c.b.slice(0, 0x1A6));          // 4300:11ab .. 11d7  BlockWrite 1A6h
  await DeleteFileIfExists(SavePath() + name + '.swg');                   // 4300:1207
  if (c.items) {                                                          // 4300:1249  quirk: only a non-empty list is written
    const parts = []; for (let it = c.items; it; it = it.next) parts.push(it.b.slice(0, 0x3F));   // 4300:1292
    await writeFile(SavePath() + name + '.swg', concat(parts));
  }
  await DeleteFileIfExists(SavePath() + name + '.fx');                    // 4300:12d6
  if (c.effects) {                                                        // 4300:1318
    const parts = []; for (let e = c.effects; e; e = e.next) parts.push(e.b.slice(0, 9));   // 4300:1361
    await writeFile(SavePath() + name + '.fx', concat(parts));
  }
}

// 4300:1388 FindTwinFile(ext) — nested in ReadCharacter: is there a SavePath + '*' + ext file whose 16-byte name = nm?
async function FindTwinFile(ext, nm) {
  let name = '';                                                          // 4300:138f
  for (const f of (await listStore()).filter((x) => x.name.endsWith(ext.toUpperCase()))) {   // 4300:13c3  FindFirst
    if (name === nm) break;                                               // 4300:13e0
    name = pstr(f.bytes.subarray(0, 0x10), 0);                            // 4300:144c  BlockRead 16 bytes at 0
  }
  return name === nm;                                                     // 4300:1477
}

// 4300:1490 ConvertPoolCharacter(pool, ch) — nested in ReadCharacter: the 11Dh-byte Pool record into the 1A6h record
// (ch zero-filled by the caller). Stats are clamped to the race (x16) / sex tables DS:3F86.. (min) / 3F88.. (max)
export function ConvertPoolCharacter(p, ch) {
  const c = ch.b;
  c[0x74] = p[0x2E];                                                      // 4300:14b2  race
  c[0x119] = p[0x9E];                                                     // 4300:14c6  gender
  setPstr(c, 0, pstr(p, 0), 15);                                          // 4300:14de  name string[15]
  const sx = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
  const rs = () => sx(c[0x74]) * 16 + sx(c[0x119]);
  let i;
  for (i = 0; i <= 5; i++) {                                              // 4300:14e3 .. 18e9
    c[0x10 + 2 * i] = p[0x10 + i];                                        // 4300:1509
    let lo, hi;
    if (i === 0) { lo = dsb(0x3F86 + rs()); hi = dsb(0x3F88 + rs()); }     // 4300:1532 / 1592  STR: race and sex
    else { lo = dsb(0x3F8C + 2 * (i - 1) + sx(c[0x74]) * 16); hi = dsb(0x3F8D + 2 * (i - 1) + sx(c[0x74]) * 16); }   // 4300:15ef ..
    if (c[0x10 + 2 * i] < lo) c[0x10 + 2 * i] = lo;
    if (c[0x10 + 2 * i] > hi) c[0x10 + 2 * i] = hi;
    c[0x11 + 2 * i] = c[0x10 + 2 * i];                                    // 4300:18df
  }
  i = 5;                                                                  // the loop variable after the loop
  c[0x1C] = p[0x16];                                                      // 4300:18fb  exceptional STR
  // 4300:191a / 195b  quirk: DS:3F8A[race*16+sex] = the exceptional-STR maximum (human male 100); with the loop variable
  // left at 5 the test lands on CHA max (+1Ah), not on +1Ch, and raises it to that value (CHA current +1Bh unchanged)
  if (variant.is13) { if (c[0x10] < dsb(0x3F8A + rs())) c[0x10] = dsb(0x3F8A + rs()); }   // cab: v13-3  v1.3 1933 .. 196C: the test lands on STR (+10h)
  else if (c[0x10 + 2 * i] < dsb(0x3F8A + rs())) c[0x10 + 2 * i] = dsb(0x3F8A + rs());
  c[0x1D] = p[0x16];                                                      // 4300:196e
  c[0x73] = p[0x2D];                                                      // 4300:1981
  c[0x75] = p[0x2F];                                                      // 4300:1994  class
  c[0x76] = p[0x30]; c[0x77] = p[0x31];                                   // 4300:19a7  age (word)
  c[0x78] = p[0x32];                                                      // 4300:19ba  HP max
  c.set(p.subarray(0x33, 0x33 + 0x38), 0x79);                             // 4300:19d9  Move 38h
  c[0x9C] = 0;                                                            // 4300:19e1
  c[0xDD] = p[0x6B]; c[0xDE] = p[0x6C];                                   // 4300:19f6 / 1a0a
  c.set(p.subarray(0x6D, 0x72), 0xDF);                                    // 4300:1a2a  Move 5 (saves)
  c[0xE4] = p[0x72];                                                      // 4300:1a3e
  c[0xE5] = p[0x73]; c[0xE6] = c[0xE5];                                   // 4300:1a52 / 1a62
  c[0xE7] = p[0x74]; c[0xE8] = p[0x75]; c[0xE9] = p[0x76];                // 4300:1a76 .. 1a9e
  c.set(p.subarray(0x77, 0x7F), 0xEA);                                    // 4300:1abe  Move 8 (thief skills)
  for (let k = 0; k < 5; k++) c[0xF6 + k] = p[0x83 + k];                  // 4300:1ad3 .. 1b27  (+F7h npc flags)
  c[0x103] = 0x2C; c[0x104] = 0x01;                                       // 4300:1b2f  money: platinum := 300
  c.set(p.subarray(0x96, 0x9E), 0x109);                                   // 4300:1b51  Move 8 (levels)
  c[0x11A] = p[0x9F]; c[0x11B] = p[0xA0];                                 // 4300:1b66 / 1b7b
  for (let k = 0; k < 4; k++) { c[0x11C + 2 * k] = p[0xA1 + 2 * k]; c[0x11D + 2 * k] = p[0xA2 + 2 * k]; }   // 4300:1b9b .. 1bfb
  c[0x124] = p[0xA9]; c[0x125] = p[0xAA]; c[0x126] = p[0xAB];             // 4300:1c10 .. 1c3a
  c.set(p.subarray(0xAC, 0xB0), 0x127);                                   // 4300:1c51 / 1c56  experience (dword)
  c[0x12B] = p[0xB0];                                                     // 4300:1c6b
  c[0x12C] = p[0xB1];                                                     // 4300:1c80
  for (let j = 1; j <= 3; j++) { c[0x12C + j] = p[0xB1 + j]; c[0x136 + j] = p[0xB4 + j]; }   // 4300:1c85 .. 1cd4
  c[0x13C] = p[0xB8]; c[0x13D] = p[0xB9];                                 // 4300:1ce6  word
  for (let k = 0; k < 5; k++) c[0x13E + k] = p[0xBA + k];                 // 4300:1cfb .. 1d4f  +13E..142
  c[0x144] = p[0xC0];                                                     // 4300:1d64  icon size
  c.set(p.subarray(0xC1, 0xC7), 0x145);                                   // 4300:1d84  icon colours (6)
  c[0x14C] = p[0xC7];                                                     // 4300:1d99
  c.set(p.subarray(0xCC, 0x100), 0x151);                                  // 4300:1db9  Move 34h
  c[0x185] = p[0x100]; c[0x186] = p[0x101];                               // 4300:1dce / 1de3
  c[0x187] = p[0x102]; c[0x188] = p[0x103];                               // 4300:1df8  word
  c[0x195] = p[0x10C]; c[0x196] = p[0x10D]; c[0x197] = p[0x10E];          // 4300:1e0d .. 1e37
  c[0x199] = p[0x110];                                                    // 4300:1e4c
  for (let k = 0; k < 5; k++) { c[0x19A + 2 * k] = p[0x111 + 2 * k]; c[0x19B + 2 * k] = p[0x112 + 2 * k]; }   // 4300:1e6c .. 1eec
  c[0x1A4] = p[0x11B]; c[0x1A5] = p[0x11C];                               // 4300:1f01 / 1f16
}

// 4300:1F21 ApplyHillsfarMinimums(hil, ch) — nested in ReadCharacter: raise the loaded character to the Hillsfar record
export async function ApplyHillsfarMinimums(h, ch, savedSel) {
  const c = ch.b;
  if (c[0x10] < h[0x14]) { c[0x10] = h[0x14]; c[0x11] = h[0x14]; }        // 4300:1f37 .. 1f6b  STR
  if (c[0x1C] < h[0x15]) { c[0x1C] = h[0x15]; c[0x1D] = h[0x15]; }        // 4300:1f72 .. 1fa6  exceptional STR
  for (let i = 1; i <= 5; i++)                                            // 4300:1faa
    if (c[0x10 + 2 * i] < h[0x15 + i]) { c[0x10 + 2 * i] = h[0x15 + i]; c[0x11 + 2 * i] = c[0x10 + 2 * i]; }   // 4300:1fc4 .. 2017
  const rd32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));
  if (rd32(c, 0x127) < rd32(h, 0x2E)) c.set(h.subarray(0x2E, 0x32), 0x127);   // 4300:2024 .. 2057  experience (signed compare)
  if ((await X.MoneyInGold(ch)) < rd32(h, 0x28)) {                        // 4300:2067 .. 2080
    for (let k = 0; k <= 4; k++) await X.DropCoinsToPool(ch, c[0xFB + 2 * k] | (c[0xFC + 2 * k] << 8), k);   // 4300:208e .. 20ad  pushes ch, money[k], k (engine fix #13)
    await X.AddPlatinumOrPool(Math.trunc(rd32(h, 0x28) / 5));              // 4300:20cc / 20d2  gold / 5 as platinum
  }
  const age = c[0x76] | (c[0x77] << 8), hage = h[0x1E] | (h[0x1F] << 8);
  if (age < hage) { c[0x76] = h[0x1E]; c[0x77] = h[0x1F]; }               // 4300:20de .. 2103
  c[0x109] = h[0xB7] > 0 ? 1 : 0;                                         // 4300:210f .. 2120
  c[0x10E] = h[0xB8] > 0 ? 1 : 0;                                         // 4300:212d .. 213e
  c[0x10B] = h[0xB9] > 0 ? 1 : 0;                                         // 4300:214b .. 215c
  c[0x10F] = h[0xBA] > 0 ? 1 : 0;                                         // 4300:2169 .. 217a
  c[0xE5] = 1;                                                            // 4300:2182
  if (h[0x26] !== 0) c[0x192] = 1;                                        // 4300:2190 / 219a
  setM7C(0x550, 0xFF);                                                    // 4300:21a4  training hall (VM 7EA8)
  G.g_7586 = 0; G.g_4FC8 = 1;                                             // 4300:21ab / 21b0
  do await X.TrainCharacter(); while (!G.g_7586);                         // 4300:21b5 .. 21bf
  G.g_4FC8 = 0;                                                           // 4300:21c1
  G.SelectedChar = savedSel;                                              // 4300:21c9 .. 21d3  parent [BP-1CAh]
  c[0x78] = h[0x21];                                                      // 4300:21df / 21e6  HP max
  c[0x12C] = (c[0x78] - (await X.ConHpBonus(ch))) & 0xFF;                 // 4300:21f5 .. 220b
  c[0x1A4] = h[0x20];                                                     // 4300:2218 / 221f  HP
}

// clear the four far pointers of a freshly read record (4300:23a0 .. 23d7 and its twins)
function clearPointers(c) {
  c.b.fill(0, 0x14D, 0x151); c.b.fill(0, 0xF2, 0xF6); c.b.fill(0, 0x18D, 0x191); c.b.fill(0, 0x189, 0x18D);
  c.items = null; c.effects = null; c.combat = null; c.next = null;
}

// read a record list file (.swg 3Fh / .fx 9 / Pool .spc 9 with a filter) appended to `head` (4300:2e42 .. 31f8)
function readList(bytes, size, make, filter) {
  let head = null, last = null;
  for (let o = 0; o + size <= bytes.length; o += size) {                  // BlockRead count = size, else stop
    if (filter && !filter(bytes[o])) continue;
    const n = make(); n.b.set(bytes.subarray(o, o + size)); n.next = null;
    if (!head) head = n; else last.next = n;
    last = n;
  }
  return head;
}

// 4300:228E ReadCharacter(fname, var ch, unused, fromSaveDisk) — the format is ImportSource (0 Curse, 1 Pool, 2 Hillsfar)
export async function ReadCharacter(fname, ch, unused, fromSaveDisk) {
  let base = fname.substring(0, 255);                                     // 4300:229a
  // 4300:22a9 .. 230a  prompt := 'Put save disk in X:' / DiskPrompt[DataSet]: the store never prompts
  // TODO(decode): OpenWithPrompt(not quiet) repeats the prompt until the file exists; a missing file leaves the record zeroed
  const f = await readFile(SavePath() + base);                            // 4300:2339  OpenWithPrompt(SavePath + fname)
  DrawText(0, 0x18, 0x0A, 0, 'Loading...Please Wait');                    // 4300:235e
  ch.b.fill(0);                                                           // 4300:236f  FillChar(ch, 1A6h, 0)
  const src = G.ImportSource ?? 0;
  if (src === 0) {                                                        // 4300:2374
    if (f) ch.b.set(f.subarray(0, Math.min(0x1A6, f.length)));            // 4300:2390  BlockRead 1A6h
    clearPointers(ch);                                                    // 4300:23a0 .. 23d7
  } else if (src === 1) {                                                 // 4300:23df
    const p = new Uint8Array(0x11D); if (f) p.set(f.subarray(0, Math.min(0x11D, f.length)));   // 4300:23f0 / 240b
    clearPointers(ch);                                                    // 4300:241b .. 2452
    ConvertPoolCharacter(p, ch);                                          // 4300:2459
  } else if (src === 2) {                                                 // 4300:246e
    const h = new Uint8Array(0xBC); if (f) h.set(f.subarray(0, Math.min(0xBC, f.length)));   // 4300:247f / 249a
    clearPointers(ch);                                                    // 4300:24af .. 24e1
    const nmv = { v: '' }; CStringToPascal(h, 4, nmv);                    // 4300:24f7
    const nm = nmv.v.substring(0, 15);                                    // 4300:2504  string[15]
    const savedSel = G.SelectedChar;
    if (await FindTwinFile('.guy', nm)) {                                 // 4300:251f
      // quirk: the twin opened is <the .hil file's base name>.guy, not the file FindTwinFile matched (4300:2545 .. 259a)
      const tb = base.slice(0, base.indexOf('.') < 0 ? base.length : base.indexOf('.'));
      const t = await readFile(SavePath() + tb + '.guy');
      if (t) ch.b.set(t.subarray(0, Math.min(0x1A6, t.length)));         // 4300:25b8
      clearPointers(ch);                                                  // 4300:25cd .. 25ff
      G.SelectedChar = ch;                                                // 4300:2604 .. 261a
      await ApplyHillsfarMinimums(h, ch, savedSel);                       // 4300:2620
      // TODO(decode): the four starting items from Hillsfar +1D/+23/+86/+87 (MakeItem + AppendItemCopy, 4300:2623 .. 27df)
    } else if (await FindTwinFile('.cha', nm)) {                          // 4300:2820
      const tb = base.slice(0, base.indexOf('.') < 0 ? base.length : base.indexOf('.'));
      const t = await readFile(SavePath() + tb + '.cha');                 // 4300:28aa (same quirk)
      const p = new Uint8Array(0x11D); if (t) p.set(t.subarray(0, Math.min(0x11D, t.length)));   // 4300:28c9
      ConvertPoolCharacter(p, ch);                                        // 4300:28db
      G.SelectedChar = ch;                                                // 4300:28f3
      await ApplyHillsfarMinimums(h, ch, savedSel);
    } else {
      // TODO(decode): the "new character from the Hillsfar record" branch (4300:2905 .. 2d9d: defaults, race := hil+2Dh+1,
      // RandomWord(256), class effects, TrainCharacter, AddPlatinumOrPool(12Ch), ConHpBonus) is only summarised in ENGINE.pas.md
    }
  }
  if (src === 0) { const k = base.indexOf('.'); if (k >= 0) base = base.slice(0, k) + base.slice(k + 4); }   // 4300:2ded / 2df7
  else base = MakeDosName(pstr(ch.b, 0));                                 // 4300:2e09
  const swg = await readFile(SavePath() + base + '.swg');                 // 4300:2e42  FileExists
  if (swg) ch.items = readList(swg, 0x3F, newItem);                       // 4300:2e4e .. 2f51
  const fx = await readFile(SavePath() + base + '.fx');                   // 4300:2f85
  if (fx) ch.effects = readList(fx, 9, newEffect);                        // 4300:2f91 .. 3094
  if (src === 1) {                                                        // 4300:30a3  Pool: racial effects of the .spc file
    const spc = await readFile(SavePath() + base + '.spc');               // 4300:30d2
    const inSet = (id) => [0x12, 0x1A, 0x2F, 0x30, 0x61, 0x6B, 0x7C].includes(id);   // set cs:226E
    if (spc) {                                                            // 4300:30de .. 31f8 (appended after the .fx list)
      let last = ch.effects; while (last && last.next) last = last.next;
      const more = readList(spc, 9, newEffect, inSet);
      if (last) last.next = more; else ch.effects = more;
    }
  }
  await FlushGameKeys();                                                  // 4300:3207
  await X.RecalcItems(ch);                                                // 4300:3212
  await X.UpdateLevelStats(ch);                                           // 4300:321d
}

// 4300:3254 LoadMonster(id, var ch): MON<DataSet>CHA / SPC / ITM.dax record id (MONSTERS.md)
export async function LoadMonster(id, ch) {
  const n = String(G.DataSet);                                            // 4300:3270
  const rec = await LoadDaxRecord('MON' + n + 'CHA', '.dax', id & 0xFF);  // 4300:32b7
  if (!rec || rec.length === 0) {                                         // 4300:32bc
    await ShowBottomPromptAndReadKey(0x0F, 0, 'Unable to load monster');  // 4300:32d7
    await TerminateGame();                                                // 4300:32dc
  }
  ch.b.set(rec.subarray(0, Math.min(0x1A6, rec.length)));                 // 4300:32ef  Move 1A6h
  clearPointers(ch);                                                      // 4300:32fd .. 3334
  G.NoDiskPrompt = 1;                                                     // 4300:3346
  const s = await LoadDaxRecord('MON' + n + 'SPC', '.dax', id & 0xFF);    // 4300:338d
  if (s && s.length) ch.effects = readList(s, 9, newEffect);              // 4300:339b .. 341a
  const t = await LoadDaxRecord('MON' + n + 'ITM', '.dax', id & 0xFF);    // 4300:346b
  if (t && t.length) ch.items = readList(t, 0x3F, newItem);               // 4300:3479 .. 34f8
  G.NoDiskPrompt = 0;                                                     // 4300:3507
  await FlushGameKeys();                                                  // 4300:350c
}

// 4300:351C AddNpcToParty(id): monster record id joins the party (party size VM word 7F3E <= 7)
export async function AddNpcToParty(id) {
  if (m7C(0x67C) > 7) return;                                             // 4300:3526
  const c = newChar();                                                    // 4300:3539  GetMem 1A6h
  await LoadMonster(id, c);                                               // 4300:3549
  c.b[0x126] = id & 0xFF;                                                 // 4300:3552
  await AddToParty(c);                                                    // 4300:355e
  await LoadCombatIcon('CPIC', id & 0xFF, c.b[0x143]);                   // 4300:357d
}

// 4300:35A8 AddToParty(var ch): append, select, the lowest free icon slot 0..7, count (VM 7F3E)
export async function AddToParty(c) {
  c.b[0x143] = 0xFF;                                                      // 4300:35b1
  if (!G.PartyList) G.PartyList = c;                                      // 4300:35b7 .. 35c8
  else { let p = G.PartyList; while (p.next) p = p.next; p.next = c; }    // 4300:35ce .. 3608
  G.SelectedChar = c;                                                     // 4300:3612
  const used = new Array(8).fill(false);                                  // 4300:3625  FillChar(used, 8, 0)
  for (let p = G.PartyList; p; p = p.next) if (p.b[0x143] <= 7) used[p.b[0x143]] = true;   // 4300:362a .. 3673  set cs:3588 = [0..7]
  c.b[0x143] = 0;                                                         // 4300:3682
  while (c.b[0x143] < 8 && used[c.b[0x143]]) c.b[0x143]++;                // 4300:3688 .. 36ad
  setM7C(0x67C, m7C(0x67C) + 1);                                          // 4300:36b3
  if (c.b[0xF7] > 0x7F) await X.UpdateLevelStats(c);                      // 4300:36bb / 36c9  NPCs only
}

// ---- saved games ----------------------------------------------------------------------------------------------------

const wordsToBytes = (w) => { const b = new Uint8Array(w.length * 2); for (let i = 0; i < w.length; i++) { b[2 * i] = w[i] & 0xFF; b[2 * i + 1] = w[i] >> 8; } return b; };
const bytesToWords = (b, w) => { for (let i = 0; i < w.length; i++) w[i] = b[2 * i] | (b[2 * i + 1] << 8); };

// SAVGAM<k>.DAT image (SAVES.md §1, 13149 bytes): the SaveGame BlockWrite sequence 4300:415a .. 434e
export function buildSavGam(k, memberNames) {
  const parts = [];
  parts.push(Uint8Array.of(G.DataSet & 0xFF));                            // 4300:415a  0000
  parts.push(wordsToBytes(G.ecl_Mem4B00));                                // 4300:4172  0001  800h
  parts.push(wordsToBytes(G.ecl_Mem7C00));                                // 4300:418b  0801  800h
  parts.push(wordsToBytes(G.ecl_Mem7A00));                                // 4300:41a4  1001  400h
  parts.push(G.ecl_CodeBuf.slice(0, 0x1E00));                             // 4300:41bd  1401  1E00h
  parts.push(Uint8Array.of(G.party_MapX & 0xFF, G.party_MapY & 0xFF, G.party_Dir & 0xFF, (G.party_Ahead ?? 0) & 0xFF, (G.party_CellAttr ?? 0) & 0xFF));   // 4300:41d6  3201
  parts.push(Uint8Array.of((G.view_PrevMode ?? 0) & 0xFF));               // 4300:41ee  3206
  parts.push(Uint8Array.of((G.view_Mode ?? 0) & 0xFF));                   // 4300:4206  3207
  const ws = new Uint8Array(12);
  for (let i = 1; i <= 3; i++) {                                          // 4300:421e .. 426e  3208
    const id = view.wallSlotId[i] & 0xFFFF, no = view.wallSlotNo[i] & 0xFFFF;
    ws[(i - 1) * 4] = id & 0xFF; ws[(i - 1) * 4 + 1] = id >> 8; ws[(i - 1) * 4 + 2] = no & 0xFF; ws[(i - 1) * 4 + 3] = no >> 8;
  }
  parts.push(ws);
  parts.push(Uint8Array.of(memberNames.length & 0xFF));                   // 4300:431c  3214
  const names = new Uint8Array(0x148);                                    // 4300:4335  3215  array[1..8] of string[40]
  memberNames.forEach((s, i) => setPstr(names, i * 41, s, 40));           // TODO(decode): stale stack bytes after each name; zeros here
  parts.push(names);
  return concat(parts);
}

// parse a SAVGAM image into the engine state (LoadGame 4300:3945 .. 3aaf); returns { count, names }
export function parseSavGam(b) {
  let o = 0; const rd = (n) => { const s = b.subarray(o, o + n); o += n; return s; };
  G.DataSet = rd(1)[0] ?? G.DataSet;                                      // 4300:3945
  bytesToWords(rd(0x800), G.ecl_Mem4B00);                                 // 4300:395f
  bytesToWords(rd(0x800), G.ecl_Mem7C00);                                 // 4300:397a
  bytesToWords(rd(0x400), G.ecl_Mem7A00);                                 // 4300:3995
  G.ecl_CodeBuf.set(rd(0x1E00));                                          // 4300:39b0
  const pos = rd(5);                                                      // 4300:39cb  720F..7213
  G.party_MapX = pos[0]; G.party_MapY = pos[1]; G.party_Dir = pos[2]; G.party_Ahead = pos[3]; G.party_CellAttr = pos[4];
  G.view_PrevMode = rd(1)[0];                                             // 4300:39e5
  G.view_Mode = rd(1)[0];                                                 // 4300:39ff
  for (let i = 1; i <= 3; i++) {                                          // 4300:3a19 .. 3a4b
    const w = rd(4); view.wallSlotId[i] = w[0] | (w[1] << 8); view.wallSlotNo[i] = w[2] | (w[3] << 8);
  }
  const count = rd(1)[0];                                                 // 4300:3a79
  const nb = rd(0x148);                                                   // 4300:3a94
  const names = []; for (let i = 0; i < 8; i++) names.push(pstr(nb, i * 41));   // length-counted (stale tails ignored)
  return { count, names };
}

// 4300:3748 LoadGame. GBP (plus request #11): `preset` = a Plus slot letter K..Z (quick / autosave): no menu, false when
// that saved game does not exist; the player's A..J menu is unchanged.
export async function LoadGame(preset = null) {
  G.ImportSource = 0;                                                     // 4300:3748
  if (!(await CheckSaveDisk())) return;                                   // 4300:3754
  let k;
  if (preset) { if (!(await fileExists(SavePath() + 'savgam' + preset + '.dat'))) return false; k = preset; }   // GBP #11
  else {
  let menu = '';
  for (let k = 0x41; k <= 0x4A; k++)                                      // 4300:375f  'A'..'J'
    if (await fileExists(SavePath() + 'savgam' + String.fromCharCode(k) + '.dat')) menu += String.fromCharCode(k) + ' ';   // 4300:376f / 37b1
  if (menu === '') return;                                                // 4300:37fa
  menu = menu.slice(0, -1);                                               // 4300:3804
  do {
    const m = HorizontalMenu('Load Which Game: ', menu, 0x0D, 0x0A, 0x0F, false, false);   // 4300:381a
    dev.screenSoon('S035');
    k = (await m).key;
  }
  while (!((k >= 'A' && k <= 'J' && await fileExists(SavePath() + 'savgam' + k + '.dat')) || k === '\0'));   // 4300:384e .. 38a1
  if (k === '\0') return;                                                 // 4300:38ab
  }
  const f = await readFile(SavePath() + 'savgam' + k + '.dat');           // 4300:38b5  OpenWithPrompt(..., quiet)
  ClearMenuLine();                                                        // 4300:391a
  DrawText(0, 0x18, 0x0A, 0, 'Loading...Please Wait');                    // 4300:391f
  G.Resuming = 1;                                                         // 4300:3940
  const { count, names } = parseSavGam(f ?? new Uint8Array(0x335D));      // 4300:3945 .. 3aaf
  G.opt_Pics = Math.floor(m4B(0x1FE) / 2);                                // 4300:3aba  (opt_Pics g_4FBE)
  G.opt_Animation = m4B(0x1FE) & 1;                                       // 4300:3acd
  G.GameSpeed = lowByte(G.ecl_Mem4B00, 0x1F8);                            // 4300:3adc
  setM7C(0x67C, 0);                                                       // 4300:3ae8  party size, AddToParty counts again
  for (let i = 1; i <= count; i++) {                                      // 4300:3af3
    const nm = MakeDosName(DeleteAll(names[i - 1], '.'));                 // 4300:3b3f / 3b44
    if (await fileExists(SavePath() + nm + '.sav')) {                     // 4300:3b7d
      const c = newChar();                                                // 4300:3b90
      await ReadCharacter(nm + '.sav', c, 1, 1);                          // 4300:3bbf
      await AddToParty(c);                                                // 4300:3bcb
      if (!(await CheckSaveDisk())) return;                               // 4300:3bcf
    }
  }
  for (let c = G.PartyList; c; c = c.next) await DeleteCharacterFiles(c); // 4300:3be6 .. 3c1d  quirk: stand-alone files go
  for (G.SelectedChar = G.PartyList; G.SelectedChar; G.SelectedChar = G.SelectedChar.next) {   // 4300:3c1f .. 3c85
    if (G.SelectedChar.b[0xF7] < 0x80) await LoadCharacterIcon(1);        // 4300:3c39 / 3c45
    else await LoadCombatIcon('CPIC', G.SelectedChar.b[0x126], G.SelectedChar.b[0x143]);   // 4300:3c6e  NPC
  }
  G.SelectedChar = G.PartyList;                                           // 4300:3c87
  G.DataSet = lowByte(G.ecl_Mem7C00, 0x624);                              // 4300:3c94  VM 7F12
  if (m4B(0x1CC) !== 0) {                                                 // 4300:3ca4  VM 4BE6: a 3D area
    if (G.view_Mode !== 0) {                                              // 4300:3cac
      if (sx16(view.wallSlotId[1]) > 0) await X.Load3DMap(lowByte(G.ecl_Mem4B00, 0x18A));   // 4300:3cb3 / 3cc4  VM 4BC5
      for (let i = 1; i <= 3; i++)                                        // 4300:3cc9
        if (sx16(view.wallSlotId[i]) > 0) await X.LoadWallSet(view.wallSlotId[i] & 0xFF, view.wallSlotNo[i] & 0xFF);   // 4300:3ce0 / 3d09
    }
  } else await X.LoadBigPic(0x79);                                        // 4300:3d1a  2D area backdrop
  await FlushGameKeys();                                                  // 4300:3d1f
  ClearMenuLine();                                                        // 4300:3d24
  G.view_PrevMode = G.view_Mode;                                          // 4300:3d29
  G.view_Mode = 0;                                                        // 4300:3d2f
  hooks.emit('saveLoaded', () => ({ slot: k, members: hooks.state.party().map((m) => m.name), dataset: G.DataSet }));   // 4300:3d38 (end)
}

// 4300:3D38 SaveSize — nested in SaveGame
function SaveSize() {
  let n = 0;
  for (let c = G.PartyList; c; c = c.next) n += 0x1A6 + 0x3F * listCount(c.items) + 9 * listCount(c.effects);
  return n & 0xFFFF;
}

// 4300:3EDD SaveGame. GBP (plus request #11): `preset` = a Plus slot letter K..Z (quick / autosave): no menu
export async function SaveGame(preset = null) {
  let k = preset;
  if (!preset) do {
    const m = HorizontalMenu('Save Which Game: ', 'A B C D E F G H I J', 0x0D, 0x0A, 0x0F, false, G.view_Mode === 2);   // 4300:3f10
    dev.screenSoon(G.view_Mode === 2 ? 'S034-CAMP' : 'S034');
    k = (await m).key;
  }
  while (!(k === '\0' || (k >= 'A' && k <= 'J')));                        // 4300:3f2d
  if (k === '\0') return;                                                 // 4300:3f3e
  G.ImportSource = 0;                                                     // 4300:3f48
  if (!(await CheckSaveDisk())) return;                                   // 4300:3f4e
  let need = (await fileExists(SavePath() + 'savgam' + k + '.dat')) ? 0 : 0x3208;   // 4300:3f58 .. 3fa2
  need += SaveSize();                                                     // 4300:3fa8
  if (DISK_FREE < need) { await ShowBottomPromptAndReadKey(0x0E, 0, "Can't save.  No room on this disk."); return; }   // 4300:3fb1 .. 3ff4
  // 4300:3ff7 .. 40eb  Assign / Rewrite / DosError in [0, 2, 12h] (cannot fail in the store)
  ClearMenuLine();                                                        // 4300:40ff
  DrawText(0, 0x18, 0x0A, 0, 'Saving...Please Wait');                     // 4300:4104
  G.ecl_Mem4B00[0x1F8 >> 1] = G.GameSpeed & 0xFFFF;                       // 4300:4125
  G.ecl_Mem4B00[0x1FE >> 1] = ((G.opt_Pics ?? 0) * 2 + (G.opt_Animation ?? 0)) & 0xFFFF;   // 4300:4133
  G.ecl_Mem7C00[0x624 >> 1] = G.DataSet & 0xFFFF;                         // 4300:414c  VM 7F12
  const names = [];
  for (let c = G.PartyList; c; c = c.next) names.push('CHRDAT' + k + (names.length + 1));   // 4300:427a .. 4319
  await writeFile(SavePath() + 'savgam' + k + '.dat', buildSavGam(k, names));   // 4300:415a .. 434e
  let n = 0;
  for (let c = G.PartyList; c; c = c.next) {                              // 4300:4359 .. 43e1
    n++;
    await WriteCharacter(c, 'CHRDAT' + k + n);                            // 4300:43a6 / 43d2
    await DeleteCharacterFiles(c);                                        // 4300:43d5
  }
  G.GameSaved = 1;                                                        // 4300:43f7
  hooks.emit('gameSaved', () => ({ slot: k, members: n }));
  ClearMenuLine();                                                        // 4300:43fc
}

// 4300:4405 ov16_init — empty
export function ov16_init() {}

export { baseName };
