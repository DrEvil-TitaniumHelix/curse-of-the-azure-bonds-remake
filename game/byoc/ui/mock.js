// mock.js — canned byoc.js back ends for screenshots of every BY screen state (?byocmock=<case>&byocauto=1). Test only:
// nothing here reads or stores game files. Cases: ok, saves (ok + a save conflict), other, damaged, nofolder, zip,
// nostore, progress (stops at 57 / 115), evicted (BY-1 notice), settings (imported; BY-5).

const NAMES = ['START.EXE', 'ITEMS', ...['8X8D', 'BODY', 'CPIC', 'ECL', 'GEO', 'HEAD', 'ITEM', 'PIC', 'SPRIT', 'WALLDEF'].flatMap((g) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${g}${n}.DAX`))];
while (NAMES.length < 115) NAMES.push(`X${NAMES.length}.DAX`);

function report(kind) {
  const files = NAMES.map((name) => ({ name, required: true, status: 'ok', size: 1000 }));
  if (kind === 'other') for (const f of files.filter((f) => /^(ECL|GEO|PIC)/.test(f.name))) { f.status = 'hash'; f.sha256 = '0'.repeat(64); }
  if (kind === 'damaged') {
    Object.assign(files[3], { status: 'missing', expectedSize: 12967 });
    Object.assign(files[40], { status: 'size', size: 4096, expectedSize: 14564 });
    Object.assign(files[70], { status: 'missing', expectedSize: 67804 });
  }
  if (kind === 'nofolder' || kind === 'zip') for (const f of files) f.status = 'missing';
  const okCount = files.filter((f) => f.status === 'ok').length;
  files.push({ name: 'GAME.OVR', required: false, status: 'ok', size: 206105 });
  const saves = kind === 'saves' ? [
    { name: 'SAVGAMA.DAT', size: 13137, ok: true, bytes: new Uint8Array(13137) },
    { name: 'CHRDATA1.SAV', size: 285, ok: true, bytes: new Uint8Array(285) },
    { name: 'SAVGAMB.DAT', size: 13137, ok: true, bytes: new Uint8Array(13137) },
    { name: 'CHRDATB9.SAV', size: 12, ok: false, reason: 'size', bytes: null },
  ] : [];
  return {
    ok: okCount === 115, manifestId: 'por-1.3', files, okCount, requiredCount: 115, matchRatio: okCount / 115,
    likelyOtherVersion: kind === 'other', gameOvr: 'match', saves, bytes: new Map(),
  };
}

export function mockByoc(kind) {
  const imported = kind === 'settings';
  return {
    async isImported() { return imported; },
    async info() {
      if (kind === 'evicted') return { manifest: 'por-1.3' };
      return imported ? { manifest: 'por-1.3', importedAt: '2026-10-18T14:02:11.000Z', count: 115, bytes: 1351836, gameOvr: 'match' } : null;
    },
    async mockCandidates() {
      if (kind === 'zip') return [{ path: 'poolrad.zip', name: 'POOLRAD.ZIP', dir: '', size: 900000 }];
      if (kind === 'nofolder') return ['README.TXT', 'SETUP.EXE', 'PHOTO.JPG'].map((name) => ({ path: name, name, dir: '', size: 10 }));
      return NAMES.map((name) => ({ path: 'POOLRAD/' + name, name, dir: '', size: 1000 }));
    },
    async validate(cands, { onProgress, signal } = {}) {
      for (let i = 1; i <= 115; i++) {
        if (signal && signal.aborted) throw new Error('cancelled');
        if (onProgress) onProgress(i, 115, NAMES[i - 1]);
        if (kind === 'progress' && i === 57) await new Promise(() => {});
        await new Promise((r) => setTimeout(r, 2));
      }
      return report(kind);
    },
    async importFiles() {
      if (kind === 'nostore') throw new Error("IndexedDB is not available in this browser (private window or blocked site data)");
      return { stored: 115, bytes: 1351836, persisted: true };
    },
    async useSession() {},
    async importSaves(rep, { replace = false } = {}) {
      const imported = [], conflicts = [], skipped = [];
      for (const s of rep.saves) {
        if (!s.ok) skipped.push(s.name);
        else if (!replace && s.name === 'SAVGAMA.DAT') conflicts.push(s.name);
        else imported.push(s.name);
      }
      return { imported, conflicts, skipped };
    },
    async listStore() { return [{ name: 'SAVGAMA.DAT', bytes: new Uint8Array(13137) }, { name: 'CHRDATA1.SAV', bytes: new Uint8Array(285) }]; },
    async removeGameFiles() {},
    async collectFromUrl() { return this.mockCandidates(); },
  };
}
