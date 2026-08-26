# 🔬 RECON · FOUC лирики + нестабильный фейдер Other (P1 #1/#2 от 008)
> Агент: explore (read-only). Дата: 2026-08-26. Назначение: Ближнему (Hub/PC) на рекон/микро-пак. НЕ применялось.

## КОРЕНЬ
**#1 FOUC лирики** (сырая ~1–1.5с, пропадают TrackMap+Voc-фейдер): разрыв между Step 8 (лирика готова, `track.orchestrator.ts:120-124` + `lyrics.bridge.ts:49-51,22-29` зеркалят сырые строки сразу) и хвостом V3-boot (TrackMap/Voc-фейдер ждут `track-fully-loaded`/`track-stem-ready` из `V3DataInterceptor.ts:201-234`, ~1.5с). Корень = нет единого ready-гейта лирики (`RehearsalLyrics.tsx:761` рендерит при `lines.length>0`, защиты от «не готово» нет).
**#2 Фейдер Other 5/6**: `V3DataInterceptor.ts:92-102` декод `decodeAudioData` **без retry** → транзиентный сбой кладёт стем в `failedStemIds` навсегда (воскрешения нет); лечится релоадом. Вторично: `:85` `slice(0,MAX_MUSIC_STEMS=6)` режет >6 муз.стемов; `:229` `track-stem-ready` шлёт массив, а frozen `audio.bridge.ts:154` ждёт `{stemId}` → инкрементальный путь мёртв.

## СВЯЗЬ С №18-BUS / V3-boot
- Включающее условие ОБА = флип на V3 + асинхронный boot (после `engine-mode.ts` flip). Гипотеза «симптомы V3-boot» ВЕРНА.
- Конкретные корни РАЗНЫЕ: №18-BUS (DONE) = расчёт гейна шины (`HybridPipelineService`), к лирике отношения 0. #2 СМЕЖЕН с №18-BUS: `other` имеет `role:'music'` → без #2 bus-фейдер №18-BUS на `other` не действует. Фикс #2 = префикс к №18-BUS.

## МИКРО-ПАК (дизайн, Ближний применяет)
**GROUP A — FOUC (safe-side, FROZEN не трогаем):**
- A1 `lyrics.store.ts`: `+ready:boolean` + `setReady`.
- A2 `RehearsalLyrics.tsx`: ранний выход `if(!ready||lines.length===0)`; `useEffect` на `before-track-change`→`setReady(false)`, `track-fully-loaded`→`setReady(true)`. Лирика появляется одновременно с TrackMap/Voc-фейдером. (bridge FROZEN → правим только store+компонент).
- Тест: render-null при ready=false; `track-fully-loaded`→render; `lyrics-rendered` НЕ переключает ready.

**GROUP B — Other 5/6 (V3DataInterceptor, SAFE):**
- B1 retry/backoff декода (2 попытки, 80ms).
- B2 успешно декодированный стем ВСЕГДА в `loadedStemIds`+`pipeline.loadStem`.
- B3 `track-stem-ready:229` → цикл `dispatch({detail:{stemId}})` (совпадение с frozen `audio.bridge.ts:154`).
- B4 `slice(0,6):85` → не резать builtin `other`.
- Тесты: retry ловит other; 7 стемов не режутся; dispatch по одному; мёртвый стем → failedStemIds.

Канон: tsc/vi дифф идентичен, vitest green. Frozen не трогать.
