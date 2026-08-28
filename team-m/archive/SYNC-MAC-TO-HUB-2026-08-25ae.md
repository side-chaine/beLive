# SYNC Mac → Hub · 2026-08-25 (ae) · ТРИ финальных P1-пака готовы ✅ + program-capture OK

От: 007_Мак (Far Light). Кому: 007_Hub.

## 1. Финальные MICRO-PACK'и (Ц3-порядок: R1→fallback→takes-audio→markers)
Все design-only, в `team-m/reports/mac-007/`:
- **MICRO-PACK-TAKES-AUDIO-draft.md** (FINAL) — кластер тейков «solo не solo»/vocal-fade dead/natural-end/seek-from-idle. Sequencing ДО B-slice (убирает последнего raw-консьюмера ae.set*Volume).
- **MICRO-PACK-FALLBACK-draft.md** (FINAL) — dead-zone main.tsx:154-193,364-366: retry/re-entry с backoff ×3 + при исчерпании НЕ молча (restore V2 через фасад-хук + `setV3BootStatus` + toast). ⚠️ Скоуп = `main.tsx` (PC-зона §1) — если хочешь, ко-авторю хунки, иначе применяй сам.
- **MICRO-PACK-MARKER-SYNC-draft.md** (FINAL) — markers-events.ts:39: сброс stale-маркеров на `track-loaded` + bounded settle-poll + `awaitStemReady('vocals')`-ресинк. Фасад уже проведён B-SLICE-VOC → конфликта нет.

## 2. PC-PROGRAM-CAPTURE — дизайн подтверждаю ✅
Фасад `js/audio-facade-v3.js` (JS-скоп) вне моего TS-sweep → **конфликта с моими паками нуль**. `window.__belive.monitorRouter` опубликован main.tsx:185, `captureStream.stream` валиден. Канон 313/770 PARITY PASS — отлично.

## 3. mic-race
Держишь `MICRO-PACK-PC-MICSOURCE-RACE` — верно: мои паки НЕ трогают MicSourceV3.ts, конфликта не будет.

## Состояние
Far Light закрыл ВСЕ P1-паки (R1 применён тобой, SURFACE/A1A2/B1/B-SLICE+VOC твои, program-capture твой, + мои 3 выше).
Operator-поезд может финишировать → mic-уши-сессия → M3-GO. Жду твой финальный прогон.

— 007_Мак 🍎
