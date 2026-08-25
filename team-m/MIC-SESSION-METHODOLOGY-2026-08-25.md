# ТЕСТ-ПЛАН · MIC-УШИ-СЕССИЯ (N5) · Far-Light методология · 2026-08-25 · агент: explore (read-only)

**Источники:** PLAN §4/§5 · LATENCY-REGISTRY (§A/E/F/H) · PARITY-LEDGER · B-SLICE-AUDIT · 431/430/429 reports.
**Гейт:** сессия НЕ назначается, пока не закрыты B-slice + F-2-дубль.

## 0. Pre-flight (на всю сессию)
P1 VITE_ENGINE=v3 + Chrome-only + latencyHint interactive (C14). P2 свежий бут, `[AETHER] ✅ HybridPipelineService — ACTIVE`. P3 фасад оживлён (audioContext/isPlaying/setVocalsVolume/setInstrumentalVolume живые). P4 гард delegateSync продлён на volume (main.tsx:135-145) — консольный вызов delegateSync('setInstrumentalVolume',0) при v3 → блок-лог, звук не меняется. P5 H4.1 premise устранён, легит UI-записи проходят. P6 проводная гарнитура (G14, без 120мс delay). P7 трек A (5 стемов), RouteCheck 5 routes. P8 база: П-8 №1 = FPS61/heap120MB; RTL §H = baseLatency .01/outputLatency .043@48k. P9 канон A4 сверен с TSC-ledger.

## 1–3. B-slice ретесты ×3
**П1 SOLO-ПРЕВЬЮ** (useTakesPlayback applySoloMute:48-54 / restore:56-68): duck музыка+вокал→тишина, после unduck громкости = store-значениям (НЕ единица), store не изменился, без double-apply. уши✅+CDP🟢.
**П2 VOCAL-FADE** (ControlDeck:279/:291 + VolumeControls:76/:82): монотонно 0→1→0, 0=тишина вокала, инструментал не затронут, зеркала store синхронны. уши✅+CDP🟢.
**П3 АВТОПАУЗА** (useTakesPlayback:108): stopPreview({pauseEngine:true})→pause; stopPreview()→играет; ae.isPlaying истинен при игре/ложен на паузе. CDP🟢+уши✅.

## 4. RTL-ГОЛОС (LATENCY §E, 3 ступени)
(1) testPulse 1kHz/60ms — оба выхода напрямую, Босс: «щелчок мгновенно». (2) Impulse harness `runImpulseTest()` (изолированный ctx 44100, stretch blockMs40/interval20, 1-сэмпл impulse, CaptureWorklet) — PASS: peak>0.5 && |sampleShift|≤5. (3) RTL голоса: Босс поёт при самомониторе, оценивает отставание; CDP-фиксация baseLatency/outputLatency/inputLatency/sampleRate. Ожидание ~15-25ms@interactive. ДО/ПОСЛЕ каждой примочки → строки §H.

## 5. П-8 №2 ПОД НАГРУЗКОЙ ЗАПИСИ
База №1 (покой): FPS61/heap120/uptime0.2. Процедура: свежий бут→снимок №1; запись тейка ≥30-60с непрерывно; на середине снимок №2 (FPS скользящий 10с, long tasks, audioglitch-события); повтор 2-й тейк; после стопа №3. Критерии (ратфицирует Ц3): FPS≥~55; heap рост за тейк ограничен, возврат к базе, НЕТ монотонного роста через 3 тейка; audioglitch нет; уши✅ без заиканий; canvas волна не пустая.

## 6. TRIM-BASIS ПОЛНЫМ ОБЪЕКТОМ
В консоли `[TRIM-BASIS]{…}` → ПКМ Store as global → `copy(JSON.stringify(temp1))` → полный JSON (16 полей: blockId,slot,blockStart,engineNow,rawDeltaSec,rawDeltaMs,wasClippedBefore,wallDeltaSec,computedTrim,oldTrim,fixDeltaMs,tempoRate,takeKind,v3Active,recorderInitMs,seekMs). Ожидания: rawDeltaSec малое отрицательное (−0.0408 якорь); v3Active true; recorderInitMs/seekMs конечные.

## 7. B-SLICE ретесты — доп CDP-проверки
get audioContext: `window.audioEngine.audioContext === __belive.pipeline.ctx` (identity, единый контекст). get isPlaying: bool синхронно транспорту. setInstrumentalVolume: duck проходит + канал клетки заблокирован — переключение трека A→B→A (Cage watchdog 3×500мс) НЕ глушит V3-стемы, deactivate не шлёпает в 1. setVocalsVolume: H4.1-warn ровно 1× на метод. уши✅+CDP🟢+static🟡 (BusFader18 green post-B-slice).

## 8. F-2-ДУБЛЬ (×2 независимых прогона, свежий бут каждый)
Мик enable → самомонитор → пение → v-Mix on/off → мик off. Метрики: слышимость самомонитора; `_monitorGain` ramp 0↔цель (20ms); `_vmixMicGate` 1.0/0.0, музыка мимо гейта; `_micDelay.delayTime===0` (G14); v-Mix стерео мик→R, вокал→L, музыка centre (TASK-015); RTL §E. Оба прогона идентичны ⇒ закрыто; расхождение ⇒ дрейф.

## Репортинг
PARITY-LEDGER (каждый ушной вердикт), LATENCY §H (RTL), B/D+F5 (проверка наличия дельта-строк B-slice и F-2; новые фиксы аудиографа — отдельными MICRO-PACK с дельтой). Форма A4. Любое «поправить frozen» = СТОП.

— explore · read-only
