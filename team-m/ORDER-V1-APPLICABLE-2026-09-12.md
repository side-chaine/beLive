# ORDER-V1-APPLICABLE · 007 от CEO_1 · 2026-09-12
**Основание:** GO Никиты «дай 007 на проработку то, что уже можно точно применять». Источник: REPORT MO-engine-v3 (team-m/zones/mo-engine-v3/REPORT-2026-09-12.md). Диспетчер/штрафы: Оператор через цепь, по маркеру, каждый пункт отдельным коммитом.

## ПРИМЕНИМОЕ ЯДРО (7+1, без 🔴-зависимостей)
1. **liveStems-геттер** в HybridPipelineService: chainA.stems минус _deadStems (has() не врёт; addStem:204 ДО ensureSlot:206 не трогать — только геттер). Предпосылка п.2-4.
2. **Ended-watchdog**: V3StatePublisher._tickLoop → transport.notifyNaturalEnd() при t ≥ duration−ε; **ε=50ms именованной константой с комментарием «тюнинг за Никитой»**. Приёмка: vitest-кейс ended; loop=true не срабатывает; 71/71 зелёные.
3. **Фасад-адаптеры (6)**: isPlaying · duration · stems→liveStems · enable/disableVocalMix→setVMix (гарды VolumeControls.tsx:90/:104 — TypeError-краш при выключении V-Mix) · detachProgramSource + MonitorRouter.detach (утечка useTakesPlayback:74) · loadAdditionalStems (+generation-гард+дедуп; зовут QuickActions:214/MixerPanel:179). Кейс-21 G-5 пин — аменсируется в том же коммите.
4. **Kick-бин из Гц**: HPS:243 fftSize=256 → бины по sampleRate (187.5Hz); паттерн hzToBin есть (useStemWaveform.ts:146); fftSize-матрица по 005-2 (drums→1024); комментарий stem-reactive.ts:68 привести в соответствие.
5. **drums+backing в STRETCH_PRIORITY** (StretchInstancePool.ts:13-21, _priorityOf:61=65535 — drums выселяется первым).
6. **ESLint-ratchet `as any`**: baseline = текущий N, gate на новый код (до него — иначе ловит свои шаги).
7. **BPM ×playbackRate-фикс** (bpm nullable, types/track-meta.types.ts:21): null → слой пропускается без краша; визуальный дизайн «холст без BPM-слоя» — НЕ решать, это 🔴 Никиты.
8. *(опция, только если 1-7 чистые)* **Эскалация все-dead → audioglitch** на существующем stretch-crash (V3DataInterceptor :251-263), без дублей листенеров.

## 🚫 НЕ ТРОГАТЬ (ждут 🔴 Никиты)
PixiJS-чанк и Z3-рендер в PVS · onBothEnded-мост (волна-2) · любые design-вердикты визуала.

## ПРИЁМКА КАЖДОГО ПУНКТА
tsc Δ≤0 к 181 · vitest engine-v3 71/71 + фасад 23/23 + общий 812/68 без регрессий · PARITY · verify:ci · frozen не тронут.

## ОТЧЁТ (после последнего коммита)
Строка СВЕРХУ в /mnt/c/Users/nikit/beLive-bridge/TRIGGERS/CEO_1.md:
`[HH:MM] от 007 · В1-ПРИМЕНИМОЕ ГОТОВО: <N>/8 применено, коммиты <sha-список>, гейты <tsc/vitest/PARITY>, что не прошло и почему · ТВОЙ ШАГ: CEO_1 собирает рапорт Никите · СЛЕДУЮЩИЙ: СТОП`
Диспетчер разбудит CEO_1 сам. Ландшафтная мина на пункте — не продавливать: пункт в «не прошло» с причиной, цепь идёт дальше (стоп-точка — ответ «задача выполнена?» — за Никитой).
