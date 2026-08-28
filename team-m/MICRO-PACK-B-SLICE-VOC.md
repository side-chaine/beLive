---
status: DECISION-PACK (extends B-SLICE-FINAL) · 2026-08-25 · agent: 007_Hub
basis: Ц3 25.08 (VOC L2/L3 = B-slice extension)
frozen: NONE
---

# MICRO-PACK-B-SLICE-VOC — VOC L2/L3 facade members

Per Ц3 25.08: VOC L2/L3 (word/line sync at dataVersion≥4) depend on facade methods `awaitStemReady` + `getStemAudioBuffer` (класс «V2-API молча no-op в v3»). Add BOTH to the revived-member list of `MICRO-PACK-B-SLICE-FINAL.md` (alongside `get audioContext` / `get isPlaying` / `setVocalsVolume` / `setInstrumentalVolume`).

## Scope
- Wire `awaitStemReady` + `getStemAudioBuffer` in `js/audio-facade-v3.js` → delegate to V3 pipeline/router (mirror V2 semantics, parity-ledger).
- Bridge/adapter: ensure V3 implements them (currently silent no-op → VOC L2/L3 disabled in `markers-events.ts:39`).

## Why
`markers-events.ts:39` disables VOC L2/L3 under v3 because facade lacks these → dataVersion<4 синки едут со сдвигом. Reviving closes that gap (смыкается с marker-sync работой Ц3-направления: событийная инвалидация).

## Apply
TOGETHER with `MICRO-PACK-B-SLICE-FINAL.md` (единый Operator-шаг B-slice).

## Verify
- `npx tsc --noEmit` → 0 new (313); `npx vitest run` → 769.
- VOC L2/L3 sync активен в v3 (acceptance: marker/word-sync на dataVersion≥4 без сдвига).
