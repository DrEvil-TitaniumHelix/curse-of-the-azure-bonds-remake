# argcheck self-test (cab-rt) — fixture, not pseudocode

Two correct calls and one deliberately reversed call (the Ghidra order) must give OK, OK, MISMATCH.

### 0000:002F entry

```pascal
PlayOrStopSound(g_25AC);                 { 0000:0151 }
```

### 01A0:0000 DrawFrame

```pascal
ClearRectangle(1, 1, $26, $16);          { 01A0:0006 }
```

### 01A0:0000 DrawFrame (reversed on purpose)

```pascal
ClearRectangle($16, $26, 1, 1);          { 01A0:0006 }
```
