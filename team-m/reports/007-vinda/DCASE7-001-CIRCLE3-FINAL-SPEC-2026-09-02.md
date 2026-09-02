# DCASE7-001 · КРУГ-3 · ФИНАЛЬНАЯ СПЕКА v2 FOUC-ГЕЙТА (001)

**001 · финал · 2026-09-02 · HEAD e5f08ab · канон 282/803/67.**

## 0. ИНТЕГРАЦИЯ (все удары 002)
У-1 арм на before-track-change по tc-данным + toTrackId-guard (закрывает гонку V3-vs-V2-потоков и У-5) · У-2 watchdog 1200мс · усиление-5 flush-сиблинг · У-4 тесты а-д. Instant-check снят 002 сам (при У-1-патче blocks.store уже пуст — blocks-events:41-43).

## 1. МЕХАНИКА
- **АРМ:** listener before-track-change в lyrics.store (аддитив :83-85 внутри if(document)-блока, BAC-001-строки нетронуты). Detail = только loader:72-73 {fromTrackId,toTrackId}; actions:57/:157 bare Event (teardown) → guard `!detail?.toTrackId → return` (пропуск арма; BAC-001-onTrackChange уже сбросил lyricsReady — семантика корректна).
- **ДИСКРИМИНАТОР:** `tc.tracks.find(t => t.id === detail.toTrackId)`, tc = (window).trackCatalog (fresh гарантирован: loader:56-57 пишет ДО Step 3 :72; find-by-id против index-гонок). `hasStructure = track?.blocksData?.length>0 || track?.syncMarkers?.some(m => m.blockType && m.blockType!=='unknown')`.
- **WATCHDOG 1200мс:** fire → structurePending:false (raw-деградация; BAC-001-5000 независим). РЕ-АРМ: новый before-track-change → clearTimer + пере-дискриминация + setState.
- **РЕЛИЗ (2 пути):** (i) useBlocksStore.subscribe: blocks.length>0 → clearTimer+false; (ii) сиблинг-if после flush-ветки (:79-83 нетронуты): lyricsReady-открытие && structurePending && blocks>0 → releaseStruct() тем же тиком (TDZ безопасен).
- **GUARDS RehearsalLyrics (порядок фиксирован):** BAC-001 :764 первым, `if (structurePending) return null;` сразу после. Селектор s.structurePending (~:40).

## 2. ПРАВКИ
lyrics.store.ts: import useBlocksStore (~:2, вне BAC-001-строк) · LyricsState +structurePending (init false) · аддитив-блок :83-85 · сиблинг-if. RehearsalLyrics.tsx: +1 селектор, +1 guard. NEW src/stores/__tests__/lyrics-structure-gate.test.ts (jsdom-pragma при дефолт node; fake timers; мок window.trackCatalog).

## 3. ТЕСТЫ (8 кейсов · Δ vitest 811/68)
К1 арм+релиз (tc blocksData>0 → true; setBlocks → false, таймер снят) · К2 без структуры → false мгновенно · К3 watchdog 1200 → false · (а) изоляция флагов (lyricsReady не тронут) · (б) watchdog→raw при lines>0 · (в) двойной свитч A→B→A с ре-армом таймера · (г) гонка-инверсия: арм при пустом ld.textBlocks по tc-данным; bare Event → нет арма · (д) ранние blocks: арм → setBlocks до track-loaded → false сразу, flush без ре-холда.

## 4. СТОП-ГЕЙТЫ
tsc 282 Δ0 · vitest 811/68 (0int 0load) · frozen 2/2 · PARITY (Step 3 = engine-agnostic) · смоук Никиты: ①структурированный — плашка ≤300мс, raw нет ②без блоков — raw сразу ③свитч — не залипает ④второй трек — ре-арм ⑤NEW: typed-маркеры без blocksData — гейт армится, raw НЕ флэшит.

## 5. РИСКИ
(1) false-positive дискриминатора → raw на 1200мс (деградация, не поломка) · (2) сторонний setBlocks разряжает гейт раньше — но это реальная структура трека · (3) deleteTrack без detail → прошлый арм доживает до 1200мс.
