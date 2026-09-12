# MICRO-PACK · В1-ПРИМЕНИМОЕ (7+1) · Оператор ← 007 · 2026-09-12 14:0x

**Основание:** ORDER-V1-APPLICABLE (CEO_1, GO Никиты) ← REPORT MO-engine-v3 (прогон 001→005×4→002→001→009 ДЕРЖИТ).
**КАНОН-СНАПШОТ (живой, 14:02):** tsc=181 · vitest 812/68/0int (10.8s) · PARITY PASS (посл. гейт-прогон) · as-any baseline = 597 (замер 007, grep -rc по src).
**Правило применений:** каждый пункт = ОТДЕЛЬНЫЙ коммит; после каждого: `npx tsc --noEmit | grep -c "error TS"` → **Δ≤0 к 181**; `npx vitest run --silent` → 812/68 без регрессий (двигательные файлы: engine-v3 + audio-facade 71+23 внутри общего числа). Frozen-список МО-engine-v3: AudioEngineV2.ts/patchV1.ts/bridges/track.orchestrator.ts — **уже не существуют в репо** (009-уточнение), но правило «_приватные поля не трогать» живо: геттер ДОБАВЛЯЕМ, существующие приватные поля не переименовываем.

---

## ПУНКТ-1: liveStems-геттер (HPS)
Файл: `src/audio/engine-v3/pipeline/HybridPipelineService.ts`
- Есть: `:72 private readonly _deadStems = new Set<string>()`; `:136 get chainA(): StemChain`; `:204 this._chainA.addStem(busAStem)` ДО `:206 ensureSlot` (порядок НЕ трогать); `:268/:273/:277` — запись/чтение _deadStems.
- ДЕЛАТЬ: публичный геттер `get liveStems(): string[]` — id из `chainA.stems`, **минус** `_deadStems` (и минус `_crashedStems`? НЕТ — только dead, crashed отдаём: crashed ≠ dead-провод; отчёт п.3 говорит «фильтр лжи» для has()-семантики).
- НЕ ДЕЛАТЬ: не менять addStem:204/ensureSlot:206 порядок; не трогать _deadStems-механику.
- Приёмка: tsc Δ0; vitest без регрессий; геттер используется пунктом-3 (зависимость!).

## ПУНКТ-2: ended-watchdog (V3StatePublisher)
Файл: `src/audio/engine-v3/integration/V3StatePublisher.ts` (`:53 _rafHandle = requestAnimationFrame(this._tickLoop)`; `:143 publishSeek(t, this.transport.duration)` — тик имеет доступ к transport; `:107 const duration = this.transport.duration`)
- ДЕЛАТЬ: в тик-цикле — если `t >= duration − ε` И `isPlaying` И НЕ loop-режим → `this.transport.notifyNaturalEnd()`. **ε = 50ms именованной константой** `NATURAL_END_EPSILON_MS = 50` с комментарием `// тюнинг за Никитой (🔴-параметр, ORDER-V1 п.2)`. Idempotent-гард (не звать повторно для того же трека: сбрасывать флаг при load/seek).
- TransportV3: проверить наличие публичного `notifyNaturalEnd` — grep показал только `:62 onTrackEnded` и `:287 _handleTrackEnded`. **Если notifyNaturalEnd отсутствует** — добавить тонкий публичный метод `notifyNaturalEnd()` → `this._handleTrackEnded()` (не приватный напрямую, имя из плана 001).
- НЕ ДЕЛАТЬ: не менять loop-логику HybridLoopStrategy; watchdog НЕ срабатывает при loop=true (проверить источник loop-флага: transport.loop или HybridClock).
- Приёмка: НОВЫЙ vitest-кейс в `src/audio/engine-v3/integration/__tests__/` (или рядом с существующими): (а) тик при t≥duration−ε → ended-событие/notifyNaturalEnd вызван ровно 1 раз; (б) loop=true → НЕ вызван; (в) повторные тики после ended → не дублируют. 71→72 engine-v3 (или +n, зафиксировать в коммите).

## ПУНКТ-3: фасад-адаптеры (6 шт)
Файлы: `src/audio/engine-v3/integration/V3DataInterceptor.ts` (фасад-контракт 23/23 в `src/audio/audio-facade-v3.test.ts`), `src/audio/engine-v3/monitor/MonitorRouter.ts` (`:285 attachProgramSource` — detach отсутствует), `src/services/track.loader.ts` (`:493/:543 ae.loadAdditionalStems` — метода на фасаде НЕТ), `src/components/VolumeControls.tsx` (`:90 if (vocalMix) ae.disableVocalMix()` / `:97 ae.enableVocalMix()` — disable-гарды отсутствуют), `src/main.tsx` (boot, `:118 interceptor`, `mm.audioEngine`-потребители `:387/:494/:514/:562`).
- ДЕЛАТЬ:
  a) **isPlaying/duration**: геттеры-адаптеры на фасаде (источник: transport V3StatePublisher:107/:111 уже читает `this.transport.duration`/isPlaying — мост в интерсептор/main.tsx boot-объект window.audioEngine);
  b) **stems → liveStems**: свойство stems (или getStems()) отдаёт liveStems-геттер п.1;
  c) **enable/disableVocalMix → setVMix(on: boolean)**: унифицированный метод; В VolumeControls.tsx:90/:97 заменить прямые enable/disable на setVMix с **гардом существования метода** (enable-гарды есть :92-96/:106-112 — сделать симметрично disable: TypeError при выключении включённого V-Mix);
  d) **detachProgramSource + MonitorRouter.detachProgramSource(node)**: симметрично :285 attach; потребитель утечки — useTakesPlayback (превью-тейк в program-capture шине);
  e) **loadAdditionalStems(stems)**: новый метод на фасаде (+**generation-гард**: stale-ответы старой генерации отбрасываются; +**дедуп**: повторная загрузка не пушит буфер дважды — отчёт: «addBuffers = push (HPS:713-715) → двойной WASM-буфер»); зовут QuickActions.tsx:214 / MixerPanel.tsx:179 через track.loader.ts:494/543 (`if (!tc?.tracks || !ae?.loadAdditionalStems) return` — гард уже есть, метода нет).
- Кейс-21 G-5 пин: **аменсируется в этом же коммите** (осознанная ratchet-амендация, ORDER п.3): обновить пин-комментарий на новый якорь.
- Приёмка: audio-facade-v3.test.ts 23/23 (или 23+n с новыми кейсами — зафиксировать); tsc Δ0; vitest 812+ без регрессий.

## ПУНКТ-4: kick-бины из Гц + fftSize-матрица
Файл: `src/audio/engine-v3/pipeline/HybridPipelineService.ts` `:242-243` (`const meter = this._ctx.createAnalyser(); meter.fftSize = 256` — 48000/256 = 187.5 Гц/бин; комментарий stem-reactive.ts:68 говорит «50-150 Hz» — фактически бины 2-7 = 375-1312 Гц, ловит вокал-bleed).
- ДЕЛАТЬ: `hzToBin(hz)` по паттерну `src/hooks/useStemWaveform.ts:146`; fftSize-матрица по 005-2: **drums → 1024** (остальным можно 256/512 — матрица из отчёта 005-2); привести комментарий `src/foundation/event-bus/wrappers/stem-reactive.ts:68` в соответствие с новой реальностью.
- Приёмка: tsc Δ0; vitest без регрессий; в коммите — строка «бины бочки = X-Y Гц при fftSize N».

## ПУНКТ-5: drums+backing в STRETCH_PRIORITY
Файл: `src/audio/engine-v3/pipeline/StretchInstancePool.ts` `:13-21` (таблица: instrumental/vocals/bass/guitar/keys/piano/other; `_priorityOf:61` = 65535 дефолт → drums выселяется первым при >7 стемах).
- ДЕЛАТЬ: добавить `drums: N, backing: N+1` (после piano, перед other; числа выбрать по смыслу — drums НЕ жертва: например drums: 6, other: 7, backing: 8 или drums выше — согласуй с комментарием «главный визуальный стем — самый незащищённый» из отчёта: drums должен быть НЕ последним; `backing` тоже в таблицу).
- Приёмка: tsc Δ0; существующий StretchInstancePool-тест (если есть в 9 тест-файлах — проверить) зелёный.

## ПУНКТ-6: ESLint-ratchet `as any`
- Baseline = **597** (замер 007: `grep -rc " as any" src --include=*.ts --include=*.tsx | awk sum`). НЕТ отдельного lint-скрипта для ratchet — конфиг `.eslintrc*` (проверить наличие: `npm run lint` = eslint . --max-warnings 0 — СТРОГО; не включать ratchet в max-warnings!).
- ДЕЛАТЬ: минимальный ratchet-механизм: либо (а) отдельный скрипт `scripts/verify-as-any.mjs` (node-only): считает `as any` в src, сравнивает с константой 597 в самом скрипте, exit 1 при превышении (новый код = +), печать «N/597»; либо (б) eslint-rule override — но НЕ поднимать max-warnings. Рекомендую (а): просто, node-only, в семействе verify-*.
- Приёмка: `node scripts/verify-as-any.mjs` → exit 0 «597/597»; коммит с тремя файлами (скрипт + package.json script "verify:asany" + [опц] упоминание в deploy.yml НЕ добавлять — CI-сквит отдельное решение 007/CEO_1, только скрипт).

## ПУНКТ-7: BPM ×playbackRate null-гард
Тип уже `bpm: number | null` (`src/types/track-meta.types.ts:21` — подтверждено 007). Краш-точка: поиск умножения bpm×playbackRate — вероятные места: practice/pitch-модули, HybridClock.setPlaybackRate(:134 rate>0 throw), pitch-engine. 
- ДЕЛАТЬ: найти все места, где `bpm` используется в арифметике с playbackRate/скоростью без null-гарда; добавить `if (bpm == null) return/skip-layer` — «слой пропускается без краша». **Визуальный дизайн «холст без BPM-слоя» НЕ решать — это 🔴 Никиты** (ORDER п.7).
- Приёмка: tsc Δ0; vitest без регрессий; перечислить в коммите закрытые точки.

## ПУНКТ-8 (ОПЦИЯ — только если 1-7 чистые): эскалация все-dead → audioglitch
Файл: `src/audio/engine-v3/integration/V3DataInterceptor.ts` `:251-263` (блок loadedStemIds/failedStemIds + CustomEvent track-fully-loaded).
- ДЕЛАТЬ: если ВСЕ стемы трека dead (успешных 0, dead = все из loadedStemIds в _deadStems) → эскалация в существующий stretch-crash-канал (audioglitch), БЕЗ дублей листенеров (одна подписка при boot).
- Приёмка: tsc Δ0; vitest; комментарий «все-dead = движок жив, данные мертвы → глитч-канал».

---

## 🚫 ЗАПРЕТЫ (список ORDER + замеры 007)
PixiJS-чанк и Z3-рендер в PVS · onBothEnded-мост (волна-2) · design-вердикты визуала · порядок addStem/ensureSlot · приватные поля ядра (только НОВЫЕ геттеры/методы) · loop-механику HybridLoopStrategy · max-warnings/eslint-строгость · любые правки frozen-эпохи (файлы уже не существуют — просто не восстанавливать).

## ПРОТОКОЛ КОММИТОВ
Один пункт = один коммит. Формат: `fix(v3): п.N <суть> [В1-приказ, базлайн tsc=181/vitest=812]`. Если пункт натыкается на мину → СТОП по пункту, коммитить НЕЛЬЗЯ, доклад 007 (пункт уйдёт в отчёт «не прошло + причина»). Ландшафтная мина не продавливается — цепь идёт дальше (ORDER-правило).

## ВЕРИФИКАЦИЯ ИТОГА (после всех коммитов)
`git log --oneline -N` (список sha) · `npx tsc --noEmit | grep -c "error TS"` = 181 · `npx vitest run --silent` = 812(+новые)/68/0int · `node scripts/verify-bridge-parity.ts` = PASS · `npm run verify:ci`-эквивалент по-гейтово (events+reach+inert+docvis+junction — junction 3 violations = канон-CF-батч, НЕ регрессия).
