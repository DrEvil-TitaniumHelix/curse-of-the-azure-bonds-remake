# ECL call argument audit

Input: `decode/pseudo/ECL.pas.md`; SHA-256 `9a5e05f6d7ab12a280572ee1289e1ebd80c66a00bfdc3c85cfbffae7b959770f`.

Calls: **93**; OK **81**, MISMATCH **0**, UNSURE **12**.

Reproduce: `python decode/tools/argcheck.py ECL`.

Pushes appear in assembly execution order since the preceding call (excluding BP prologues and near-call return CS). Values are conservative register provenance, not runtime values. Targets use encoded relative/far operands and exported names. Pascal first arguments occupy the highest BP slots; callee RET cleanup and LES/LDS accesses determine word grouping. Byte arguments compare AL only when the callee reads a byte. A mismatch identifies a proven differing scalar slot; unresolved widths/counts, string helpers, nested pending arguments, pointers and complex expressions remain UNSURE. Compiler intrinsics are retained as UNSURE. Semantic wrappers can differ from the native ABI. OK covers the displayed argument sources only. No unannotated statements are audited.

| Address / source line | Pseudo call | Pushes in asm order | Verdict | Evidence / limitation |
|---|---|---|---|---|
| 2200:3384 / L76 | `ecl_op00_Exit` | (none) | OK | all native argument words agree; native 2200:3385 → ecl_op00_Exit |
| 2200:3384 / L76 | `ecl_op01_Goto` | (none) | OK | all native argument words agree; native 2200:3391 → ecl_op01_Goto |
| 2200:3384 / L76 | `ecl_op02_Gosub` | (none) | OK | all native argument words agree; native 2200:339d → ecl_op02_Gosub |
| 2200:3384 / L76 | `ecl_op03_Compare` | (none) | OK | all native argument words agree; native 2200:33a9 → ecl_op03_Compare |
| 2200:33c3 / L77 | `ecl_op04_AddSubDivMul` | (none) | OK | all native argument words agree; native 2200:33c4 → ecl_op04_AddSubDivMul |
| 2200:33c3 / L77 | `ecl_op08_Random` | (none) | OK | all native argument words agree; native 2200:33d0 → ecl_op08_Random |
| 2200:33c3 / L77 | `ecl_op09_Save` | (none) | OK | all native argument words agree; native 2200:33dc → ecl_op09_Save |
| 2200:33e7 / L78 | `ecl_op0A_LoadCharacter` | (none) | OK | all native argument words agree; native 2200:33e8 → ecl_op0A_LoadCharacter |
| 2200:33e7 / L78 | `ecl_op0B_LoadMonster` | (none) | OK | all native argument words agree; native 2200:33f4 → ecl_op0B_LoadMonster |
| 2200:33e7 / L78 | `ecl_op0C_SetupMonster` | (none) | OK | all native argument words agree; native 2200:3400 → ecl_op0C_SetupMonster |
| 2200:340b / L79 | `ecl_op0D_Approach` | (none) | OK | all native argument words agree; native 2200:340c → ecl_op0D_Approach |
| 2200:340b / L79 | `ecl_op0E_Picture` | (none) | OK | all native argument words agree; native 2200:3418 → ecl_op0E_Picture |
| 2200:340b / L79 | `ecl_op0F_InputNumber` | (none) | OK | all native argument words agree; native 2200:3424 → ecl_op0F_InputNumber |
| 2200:340b / L79 | `ecl_op10_InputString` | (none) | OK | all native argument words agree; native 2200:3430 → ecl_op10_InputString |
| 2200:3440 / L80 | `ecl_op11_Print` | (none) | OK | all native argument words agree; native 2200:3441 → ecl_op11_Print |
| 2200:3440 / L80 | `ecl_op13_Return` | (none) | OK | all native argument words agree; native 2200:344d → ecl_op13_Return |
| 2200:3440 / L80 | `ecl_op14_CompareAnd` | (none) | OK | all native argument words agree; native 2200:3459 → ecl_op14_CompareAnd |
| 2200:3440 / L80 | `ecl_op15_VerticalMenu` | (none) | OK | all native argument words agree; native 2200:3465 → ecl_op15_VerticalMenu |
| 2200:3489 / L81 | `ecl_op16_If` | (none) | OK | all native argument words agree; native 2200:348a → ecl_op16_If |
| 2200:3489 / L81 | `ecl_op1C_ClearMonsters` | (none) | OK | all native argument words agree; native 2200:3496 → ecl_op1C_ClearMonsters |
| 2200:3489 / L81 | `ecl_op1D_PartyStrength` | (none) | OK | all native argument words agree; native 2200:34a2 → ecl_op1D_PartyStrength |
| 2200:3489 / L81 | `ecl_op1E_CheckParty` | (none) | OK | all native argument words agree; native 2200:34ae → ecl_op1E_CheckParty |
| 2200:34b9 / L83 | `ecl_op20_NewEcl` | (none) | OK | all native argument words agree; native 2200:34ba → ecl_op20_NewEcl |
| 2200:34b9 / L83 | `ecl_op21_LoadFilesPieces` | (none) | OK | all native argument words agree; native 2200:34cb → ecl_op21_LoadFilesPieces |
| 2200:34b9 / L83 | `ecl_op22_PartySurprise` | (none) | OK | all native argument words agree; native 2200:34d7 → ecl_op22_PartySurprise |
| 2200:34b9 / L83 | `ecl_op23_Surprise` | (none) | OK | all native argument words agree; native 2200:34e3 → ecl_op23_Surprise |
| 2200:34ee / L84 | `ecl_op24_Combat` | (none) | OK | all native argument words agree; native 2200:34ef → ecl_op24_Combat |
| 2200:34ee / L84 | `ecl_op25_OnGotoGosub` | (none) | OK | all native argument words agree; native 2200:3500 → ecl_op25_OnGotoGosub |
| 2200:34ee / L84 | `ecl_op27_Treasure` | (none) | OK | all native argument words agree; native 2200:350c → ecl_op27_Treasure |
| 2200:34ee / L84 | `ecl_op28_Rob` | (none) | OK | all native argument words agree; native 2200:3518 → ecl_op28_Rob |
| 2200:3523 / L85 | `ecl_op29_EncounterMenu` | (none) | OK | all native argument words agree; native 2200:3524 → ecl_op29_EncounterMenu |
| 2200:3523 / L85 | `ecl_op2A_GetTable` | (none) | OK | all native argument words agree; native 2200:3530 → ecl_op2A_GetTable |
| 2200:3523 / L85 | `ecl_op2B_HorizontalMenu` | (none) | OK | all native argument words agree; native 2200:353c → ecl_op2B_HorizontalMenu |
| 2200:3523 / L85 | `ecl_op2C_Parlay` | (none) | OK | all native argument words agree; native 2200:3548 → ecl_op2C_Parlay |
| 2200:3553 / L86 | `ecl_op2D_Call` | (none) | OK | all native argument words agree; native 2200:3554 → ecl_op2D_Call |
| 2200:3553 / L86 | `ecl_op2E_Damage` | (none) | OK | all native argument words agree; native 2200:3560 → ecl_op2E_Damage |
| 2200:3553 / L86 | `ecl_op2F_AndOr` | (none) | OK | all native argument words agree; native 2200:3571 → ecl_op2F_AndOr |
| 2200:3553 / L86 | `ecl_op31_SpriteOff` | (none) | OK | all native argument words agree; native 2200:357d → ecl_op31_SpriteOff |
| 2200:3588 / L87 | `ecl_op32_FindItem` | (none) | OK | all native argument words agree; native 2200:3589 → ecl_op32_FindItem |
| 2200:3588 / L87 | `ecl_op33_PrintReturn` | (none) | OK | all native argument words agree; native 2200:3595 → ecl_op33_PrintReturn |
| 2200:3588 / L87 | `ecl_op34_EclClock` | (none) | OK | all native argument words agree; native 2200:35a1 → ecl_op34_EclClock |
| 2200:3588 / L87 | `ecl_op35_SaveTable` | (none) | OK | all native argument words agree; native 2200:35ac → ecl_op35_SaveTable |
| 2200:35b6 / L88 | `ecl_op36_AddNpc` | (none) | OK | all native argument words agree; native 2200:35b7 → ecl_op36_AddNpc |
| 2200:35b6 / L88 | `ecl_op38_Program` | (none) | OK | all native argument words agree; native 2200:35c2 → ecl_op38_Program |
| 2200:35b6 / L88 | `ecl_op39_Who` | (none) | OK | all native argument words agree; native 2200:35cd → ecl_op39_Who |
| 2200:35b6 / L88 | `ecl_op3A_Delay` | (none) | OK | all native argument words agree; native 2200:35d8 → ecl_op3A_Delay |
| 2200:35e2 / L89 | `ecl_op3B_Spell` | (none) | OK | all native argument words agree; native 2200:35e3 → ecl_op3B_Spell |
| 2200:35e2 / L89 | `ecl_op3C_Protection` | (none) | OK | all native argument words agree; native 2200:35ee → ecl_op3C_Protection |
| 2200:35e2 / L89 | `ecl_op3D_ClearBox` | (none) | OK | all native argument words agree; native 2200:35f9 → ecl_op3D_ClearBox |
| 2200:3603 / L90 | `ecl_op3E_Dump` | (none) | OK | all native argument words agree; native 2200:3604 → ecl_op3E_Dump |
| 2200:3603 / L90 | `ecl_op3F_FindSpecial` | (none) | OK | all native argument words agree; native 2200:360f → ecl_op3F_FindSpecial |
| 2200:3603 / L90 | `ecl_op40_DestroyItems` | (none) | OK | all native argument words agree; native 2200:361a → ecl_op40_DestroyItems |
| 2200:365f / L104 | `ecl_OpcodeName(@DebugLog, name, ecl_CurOp)` | 2200:3662: PUSH DS ← ('segment', 'ds'); 2200:3663: PUSH DI ← ('const', 35702); 2200:3668: PUSH SS ← ('segment', 'ss'); 2200:3669: PUSH DI ← ('address', '[bp+0xff00]'); 2200:366d: PUSH AX ← ('low', ('mem', '[0x75ff]')) | UNSURE | callee layout or nested-call argument window is incomplete; native 2200:366e → ecl_OpcodeName (via stub_ov34_e3) |
| 2200:3673 / L105 | `Write(Output, name)` | 2200:3675: PUSH AX ← ('const', 0) | UNSURE | first native call is 2200:3676 (System.@WriteStr); pseudo target identity unproved |
| 2200:3673 / L105 | `WriteLn(Output)` | (none) | UNSURE | callee layout or nested-call argument window is incomplete; native 2200:367b → System.@WriteLn |
| 2200:3680 / L107 | `ecl_Dispatch` | (none) | OK | all native argument words agree; native 2200:3681 → ecl_Dispatch |
| 2200:3079 / L116 | `ov15_LoadDeps` | (none) | OK | all native argument words agree; native 2200:3079 → ov15_LoadDeps (via stub_ov15_e3) |
| 2200:3082 / L118 | `ecl_Run(ecl_VecC)` | 2200:3082: PUSH word ptr [0x4fae] ← ('mem', '[0x4fae]') | OK | all native argument words agree; native 2200:3087 → ecl_Run |
| 2200:308a / L119 | `Camp(var rested)` | 2200:308d: PUSH SS ← ('segment', 'ss'); 2200:308e: PUSH DI ← ('address', '[bp-0x1]') | UNSURE | complex expression, far pointer, or unproved register source; native 2200:308f → Camp (via stub_ov15_e1) |
| 2200:3094 / L120 | `ecl_Run(ecl_VecD)` | 2200:309f: PUSH word ptr [0x4fb0] ← ('mem', '[0x4fb0]') | OK | all native argument words agree; native 2200:30a4 → ecl_Run |
| 2200:3094 / L120 | `RedrawCurrentMode` | (none) | OK | all native argument words agree; native 2200:309a → RedrawCurrentMode (via stub_ov24_e37) |
| 2200:30a7 / L121 | `RefreshView` | (none) | OK | all native argument words agree; native 2200:30ac → RefreshView (via stub_ov28_e1) |
| 2200:3694 / L130 | `FreeAnimation(enc_Anim)` | 2200:3697: PUSH DS ← ('segment', 'ds'); 2200:3698: PUSH DI ← ('const', 29228) | UNSURE | complex expression, far pointer, or unproved register source; native 2200:3699 → FreeAnimation (via stub_ov29_e5) |
| 2200:36ad / L133 | `GetCellAttr(party_MapX, party_MapY)` | 2200:36b0: PUSH AX ← ('low', ('mem', '[0x720f]')); 2200:36b4: PUSH AX ← ('low', ('mem', '[0x7210]')) | OK | all native argument words agree; native 2200:36b5 → GetCellAttr (via stub_ov30_e6) |
| 2200:36d5 / L136 | `ecl_Run(ecl_VecE)` | 2200:36d5: PUSH word ptr [0x4fb2] ← ('mem', '[0x4fb2]') | OK | all native argument words agree; native 2200:36da → ecl_Run |
| 2200:371c / L140 | `RefreshView` | (none) | OK | all native argument words agree; native 2200:371c → RefreshView (via stub_ov28_e1) |
| 2200:3726 / L142 | `ecl_Run(ecl_VecA)` | 2200:3726: PUSH word ptr [0x4faa] ← ('mem', '[0x4faa]') | OK | all native argument words agree; native 2200:372b → ecl_Run |
| 2200:3735 / L144 | `ecl_Run(ecl_VecB)` | 2200:3735: PUSH word ptr [0x4fac] ← ('mem', '[0x4fac]') | OK | all native argument words agree; native 2200:373a → ecl_Run |
| 2200:3751 / L147 | `PartySummary(SelectedChar)` | 2200:3751: PUSH word ptr [0x6508] ← ('mem', '[0x6508]'); 2200:3755: PUSH word ptr [0x6506] ← ('mem', '[0x6506]') | UNSURE | callee layout or nested-call argument window is incomplete; native 2200:3759 → PartySummary (via stub_ov24_e2) |
| 2200:37c3 / L164 | `PartySummary(SelectedChar)` | — | UNSURE | native target not resolved in this routine |
| 2200:37e5 / L166 | `Lo(Mem[4BF2])` | — | UNSURE | compiler intrinsic; no independent native call required |
| 2200:3802 / L168 | `LoadEclBlock(ecl_Block)` | 2200:3818: PUSH AX ← ('low', ('mem', '[0x8b5e]')) | OK | all native argument words agree; native 2200:3819 → LoadEclBlock (via stub_ov07_e4) |
| 2200:3825 / L170 | `ecl_InitVM` | (none) | OK | all native argument words agree; native 2200:3825 → ecl_InitVM (via stub_ov07_e3) |
| 2200:382a / L171 | `ecl_Run(ecl_VecE)` | 2200:382a: PUSH word ptr [0x4fb2] ← ('mem', '[0x4fb2]') | OK | all native argument words agree; native 2200:382f → ecl_Run |
| 2200:3839 / L173 | `RemovePartyMember(1, 1)` | 2200:383b: PUSH AX ← ('low', ('const', 1)); 2200:383e: PUSH AX ← ('low', ('const', 1)) | OK | all native argument words agree; native 2200:383f → RemovePartyMember (via stub_ov17_e3) |
| 2200:3867 / L177 | `ecl_RunAfterNewBlock` | (none) | OK | all native argument words agree; native 2200:3868 → ecl_RunAfterNewBlock |
| 2200:3879 / L179 | `RedrawCurrentMode` | (none) | OK | all native argument words agree; native 2200:3880 → RedrawCurrentMode (via stub_ov24_e37) |
| 2200:3885 / L180 | `RefreshView` | (none) | OK | all native argument words agree; native 2200:388a → RefreshView (via stub_ov28_e1) |
| 2200:38be / L187 | `UpCase(key)` | 2200:38cd: PUSH AX ← ('low', ('mem', '[bp-0x1]')) | UNSURE | complex expression, far pointer, or unproved register source; native 2200:38ce → System.UpCase |
| 2200:38e1 / L188 | `UpCase(key)` | 2200:38e4: PUSH AX ← ('low', ('mem', '[bp-0x1]')) | UNSURE | complex expression, far pointer, or unproved register source; native 2200:38e5 → System.UpCase |
| 2200:38e1 / L188 | `ov15_LoadDeps` | (none) | OK | all native argument words agree; native 2200:38ee → ov15_LoadDeps (via stub_ov15_e3) |
| 2200:3913 / L192 | `RefreshView` | (none) | OK | all native argument words agree; native 2200:3918 → RefreshView (via stub_ov28_e1) |
| 2200:391d / L193 | `ecl_Run(ecl_VecB)` | 2200:391d: PUSH word ptr [0x4fac] ← ('mem', '[0x4fac]') | OK | all native argument words agree; native 2200:3922 → ecl_Run |
| 2200:3925 / L194 | `ecl_RunAfterNewBlock` | (none) | OK | all native argument words agree; native 2200:392d → ecl_RunAfterNewBlock |
| 2200:395d / L199 | `ecl_Run(ecl_VecA)` | 2200:3964: PUSH word ptr [0x4faa] ← ('mem', '[0x4faa]') | OK | all native argument words agree; native 2200:3969 → ecl_Run |
| 2200:396c / L200 | `ecl_RunAfterNewBlock` | (none) | OK | all native argument words agree; native 2200:3974 → ecl_RunAfterNewBlock |
| 2200:3984 / L202 | `ShortInt(party_MapX)` | — | UNSURE | compiler intrinsic; no independent native call required |
| 2200:3984 / L202 | `ShortInt(party_MapY)` | — | UNSURE | compiler intrinsic; no independent native call required |
| 2200:399e / L203 | `MoveParty` | (none) | OK | all native argument words agree; native 2200:399e → MoveParty (via stub_ov14_e1) |
| 2200:39a3 / L204 | `RefreshView` | (none) | OK | all native argument words agree; native 2200:39a3 → RefreshView (via stub_ov28_e1) |
| 2200:39e0 / L206 | `PlayOrStopSound(snd_Step)` | 2200:39e0: PUSH word ptr [0x25c0] ← ('mem', '[0x25c0]') | OK | all native argument words agree; native 2200:39e4 → PlayOrStopSound |
| 2200:39f3 / L208 | `ecl_Run(ecl_VecB)` | 2200:39f3: PUSH word ptr [0x4fac] ← ('mem', '[0x4fac]') | OK | all native argument words agree; native 2200:39f8 → ecl_Run |
| 2200:39fb / L209 | `ecl_RunAfterNewBlock` | (none) | OK | all native argument words agree; native 2200:3a03 → ecl_RunAfterNewBlock |
