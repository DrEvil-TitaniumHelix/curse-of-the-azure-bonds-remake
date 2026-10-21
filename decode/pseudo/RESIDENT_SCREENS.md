# RESIDENT screens — main program + resident game units (lane cab-mod-resident = cab-rt)

Every screen, prompt or message shown by main_0000 and the resident units. Rows/cols are 8×8 text cells (40×25).
Pseudocode: `RESIDENT.pas.md`. Ids `RESIDENT-nn`.

| id | trigger | text / window | keys | pictures | next |
|---|---|---|---|---|---|
| RESIDENT-01 | MainProgram 0000:0190, after the credits (ov01) | bottom-line menu row 24: prompt `Curse of the Azure Bonds v1.0 ` (colour 0Dh) then option `Play Demo` (text 0Ah, hotkey/selected 0Fh) (HorizontalMenu, ov26) | `D` (or Space/Enter on the only option) = demo; any other key = play; no key for 30 s = `D` (menu_TimeoutKey) | none: the rest of the screen is black — ShowTitle ends with `ClearScreen` 2100:076b after the credits (DOSBox REF-S015, #ref-1) | demo: data set 1 → ECL game loop in demo mode; else copy protection (RuneWheelCheck, unless `START.EXE x Wooden`) then the top menu (ov17 "Choose a function") |
| RESIDENT-02 | MainProgram 0000:02f6, after a demo run | credits again (ov01), then the same prompt as RESIDENT-01 with a 10 s timeout | as RESIDENT-01 | — | as RESIDENT-01 |
| RESIDENT-03 | DrawScreenFrame 01A0:0000 (and the layout routines 00D3/0136/0252/0292/0397/048D) | not a message: the frame layouts (full-screen border; bars at rows 2, 3/8 or 16; picture box (2,2)-(14,14) with column 16; combat map window cols 0..22 + side panel) drawn from the FrameTop.. symbol tables | — | 8X8D symbols (11Eh/114h + table byte) | caller's screen |
| RESIDENT-04 | StartupConfiguration 020F:0354, first run, curse.cfg cannot be created | DOS text screen (ClrScr): `Sorry, disk A can't be write-protected.` / empty line / `If these are your masters, use DISKCOPY to make duplicates.` | — | — | exit to DOS (Halt 1) |
| RESIDENT-05 | 020F:0399, first run | DOS text: `GRAPHICS ADAPTER TYPE:  [1] CGA  [2] EGA  [3] Tandy  ` + cursor | digits 1..3 only (others ignored); the digit is echoed | — | RESIDENT-06 |
| RESIDENT-06 | 020F:0419, first run | DOS text: `SOUND TYPE:  [1] PC  [2] Tandy 1000  [3] Silent  ` | digits 1..3 | — | RESIDENT-07 |
| RESIDENT-07 | 020F:04c1, first run | DOS text: `PATH TO SAVE DATA (DEFAULT - <dir>SAVE):  ` then a typed line (ReadLn, up to 80 chars) | any line + Enter | — | invalid path: RESIDENT-08; else RESIDENT-09 |
| RESIDENT-08 | 020F:0565 | `USING DEFAULT PATH: <dir>SAVE` (2 s) | — | — | RESIDENT-09 |
| RESIDENT-09 | 020F:0647, every start | DOS text (ClrScr): `TANDY 1000 USERS - Make sure NUMLOCK is on.` for 2 s | — | — | video mode switch, the game (credits) |
| RESIDENT-10 | 020F:0770 | after returning to the previous video mode: `Not enough memory to run game.  You need <n> more bytes.` | — | — | exit to DOS (Halt 0) |
| RESIDENT-11 | 020F:07d1 | `Overlay error, program abort!` | — | — | exit to DOS |
| RESIDENT-12 | DrawWrappedText 0542:06be, the text window is full and text is left | bottom row 24: `Press any key to continue` (fg 0Dh, bg 0) | any key (ReadGameKey) | — | window cleared, the text continues at the top left |
| RESIDENT-13 | ReadBottomLine 0542:0722 (ecl_op10_InputString, ReadWordNumber, ov16/ov17 names) | row 24: the prompt in fg/bg, then the typed text white on 0 from column Length(prompt)+1 | ' '..'z' typed (up to maxLen), Backspace, Enter or Esc ends (both return the text, upper-cased); in the demo one key ends | — | caller |
| RESIDENT-14 | OpenWithPrompt 0636:042a, a file is missing and the directory is a floppy (A:/B:) | BIOS text row 24 (colour 0Eh): `Insert disk B in drive A:` (DiskPrompt[DataSet] + DataDrive + ':'; set 3: `Insert disk C ...`) | any key | — | retry the open |
| RESIDENT-15 | OpenWithPrompt 0636:0462, missing file on a hard disk | row 24: `Couldn't find <name.ext>. Check install.` | any key | — | retry (endless until the file appears) |
| RESIDENT-16 | LoadDaxRecord 0636:09cd, packed record > 36000 bytes | row 24: `tempsize <n>` | any key | — | TerminateGame |
| RESIDENT-17 | WaitOverlayDisk 0636:0228 (start-up) | DOS text: `Please insert overlay disk.` | any key | — | retry until game.ovr is found |
| RESIDENT-18 | ShowBottomPromptAndReadKey 0542:0946 / ShowTimedBottomPrompt 0542:0AD9 | row 24: the caller's message in fg/bg | any key / none (MessageDelay = GameSpeed*100 ms, then cleared) | — | caller |
