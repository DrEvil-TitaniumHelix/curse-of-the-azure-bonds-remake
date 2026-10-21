# SELFTEST call argument audit

Input: `decode/tools/argcheck_test/SELFTEST.pas.md`; SHA-256 `0e07c427f2ac07dac942b102f269f24d7e9ca23182a14a03ceb3df9d54ef92d6`.

Calls: **3**; OK **2**, MISMATCH **1**, UNSURE **0**.

Reproduce: `python decode/tools/argcheck.py SELFTEST`.

Pushes appear in assembly execution order since the preceding call (excluding BP prologues and near-call return CS). Values are conservative register provenance, not runtime values. Targets use encoded relative/far operands and exported names. Pascal first arguments occupy the highest BP slots; callee RET cleanup and LES/LDS accesses determine word grouping. Byte arguments compare AL only when the callee reads a byte. A mismatch identifies a proven differing scalar slot; unresolved widths/counts, string helpers, nested pending arguments, pointers and complex expressions remain UNSURE. Compiler intrinsics are retained as UNSURE. Semantic wrappers can differ from the native ABI. OK covers the displayed argument sources only. No unannotated statements are audited.

| Address / source line | Pseudo call | Pushes in asm order | Verdict | Evidence / limitation |
|---|---|---|---|---|
| 0000:0151 / L8 | `PlayOrStopSound(g_25AC)` | 0000:0151: PUSH word ptr [0x25ac] ← ('mem', '[0x25ac]') | OK | all native argument words agree; native 0000:0155 → PlayOrStopSound |
| 01a0:0006 / L14 | `ClearRectangle(1, 1, $26, $16)` | 01a0:0008: PUSH AX ← ('low', ('const', 1)); 01a0:000b: PUSH AX ← ('low', ('const', 1)); 01a0:000e: PUSH AX ← ('low', ('const', 38)); 01a0:0011: PUSH AX ← ('low', ('const', 22)) | OK | all native argument words agree; native 01a0:0013 → ClearRectangle |
| 01a0:0006 / L20 | `ClearRectangle($16, $26, 1, 1)` | 01a0:0008: PUSH AX ← ('low', ('const', 1)); 01a0:000b: PUSH AX ← ('low', ('const', 1)); 01a0:000e: PUSH AX ← ('low', ('const', 38)); 01a0:0011: PUSH AX ← ('low', ('const', 22)) | MISMATCH | known argument differs at position(s) 1, 2, 3, 4; native 01a0:0013 → ClearRectangle |
