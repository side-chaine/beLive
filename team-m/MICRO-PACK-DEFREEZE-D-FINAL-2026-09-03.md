# MICRO-PACK-DEFREEZE-D-FINAL v1.0 — финальная волна де-фриза до frozen 0/0 + замена замка

**Автор:** Опус-5 (внешний со-Архитектор) · **HEAD:** `93eb1e6` · **Дата:** 2026-09-03 07:4x (время машины Linux)
**Канон замерен лично на этом HEAD:** `tsc=282` · `vitest 811/68` · `PARITY PASS (exit 0)` · `frozen OK: 2/2` · `build OK`
**Метод:** живое дерево + эмпирические пробы (probe-tsconfig с exclude, немифицированная пробная сборка, граф-обход импортов). Все правки в `src/` при пробах откатывались, `git diff --stat src/` пуст.
**Развилки Никиты — приняты все четыре:** ① созвездие целиком ② D-0b до волны ③ живые баги после D-0b, до D-1 ④ `frozen-zones-v2.md` в `history/`.
**Статус:** спека-сырьё для цепи 001→002→001→009. Не истина — материал для удара.

---

## §0 · ГЛАВНОЕ, ОДНОЙ СТРОКОЙ

`frozen 0/0` — бухгалтерия, а не цель: замок сегодня охраняет два файла, из которых один **не попадает в бандл вообще**, а второй патчит объект с **0 писателями**. Настоящая цель — **репо без правдоподобно выглядящего мёртвого кода**, и её замок никогда не проверял. Поэтому программа обязана закончиться не пустым манифестом, а **гейтами живости (G-1/G-2) в `verify:ci`**. Иначе через месяц вырастет новое созвездие, и снова никто не заметит.

---

## §1 · ЧТО ДОКАЗАНО ЭМПИРИЧЕСКИ (карточки клеймов)

| # | Утверждение | Доказательство | Проверено | Скоуп |
|---|---|---|---|---|
| К-1 | `AudioEngineV2.ts` не входит в прод-бандл | `npm run build` → `rg "AudioEngineV2" dist/` = **1 хит, и он комментарий** `dist/js/audio-facade-v3.js:22` | Опус, эмпирика | HEAD `93eb1e6` |
| К-2 | V2-созвездие = **замкнутый** импорт-кластер, 5 файлов / **2735** строк | `grep "from '.*(AudioEngineV2\|StemPlayer\|AudioLoader\|VocalMix\|MicrophoneManager)'" src js` вне `src/audio/core/` = **пусто**; `wc -l` = 2178+210+110+88+149 | Опус | `src/`+`js/` |
| К-3 | Снос созвездия: **tsc 282 → 272**, новых ошибок **0** | probe-tsconfig exclude ×5 → `grep -c "error TS"` = 272; diff полных списков: removed 10, **new 0** | Опус, эмпирика | — |
| К-4 | `audioContext.ts` **ЖИВОЙ — в волну не входит** | 9 импортёров: `main.tsx:16`, `engine-v3/index.ts:34`, `TakesControlStrip.tsx:18`, `useTakesPlayback.ts:7` + 5 внутри кластера | Опус | `src/` |
| К-5 | Ни один тест не конструирует классы кластера | `grep -rln "new StemPlayer\b\|new VocalMix\b\|new MicrophoneManager\b\|new AudioEngineV2\b\|loadAudio("` по `*.test.*` = **пусто** | Опус | `src/**/*.test.*` |
| К-6 | `window.liveMode` — фантом: **0 писателей**, 4 мёртвых читателя | писателей нет (полный sweep вне `node_modules/dist/docs/team-m`); читатели: `live-guard.ts:6,8,9,19` · `mode-switch.service.ts:20` · `:209-211` · `notification.ts:21-22`; исходники снесены `18cb248` (`live-mode.stub.ts`), `18f0dc4` (`js/live-mode.js`) | Опус | репо |
| К-7 | Снос `live-guard.ts` без шестерни = **PARITY FAIL = обрыв прод-деплоя** | `verify-bridge-parity.ts:225-235` CHECK-D требует `existsSync(guard.bridge)`; `deploy.yml` шаг «Verify EventBus + Bridge Parity» на push в main | Опус | — |
| К-8 | `bl-live-camera` — **0 писателей** ⇒ guard охраняет несуществующее флагом, который никто не ставит | единственное вхождение: `live-guard.ts:10` (чтение) | Опус | репо |
| К-9 | **CaptureWorklet-актив лежит готовым в `docs/`**: `282 → 202` (−80) | `cp docs/modernization/handoff/new-files/src/types/audio-worklet-global.d.ts src/types/` + `cp docs/modernization/handoff/src/.../CaptureWorklet.ts src/.../` → tsc **202**, ошибок CaptureWorklet **0**. Оба файла откачены | Опус, эмпирика | — |
| К-10 | Пустой манифест не ломает `check-frozen.mjs` | `checkBlock` по пустым объектам → `console.log('frozen OK: 0/0')`, `process.exit` не вызывается ⇒ **exit 0** | Опус, чтение `scripts/check-frozen.mjs` | — |
| К-11 | `index.html:233 id="live-mode"` — **живая кнопка, НЕ трогать** | ведёт в `mode-switch.service.ts activateLive()`, который делает реальную работу (`setBodyMode`/`setTransportOpen`/`emitModeChanged`/`applyModeVolumePreset`); мёртв только вызов объекта `:209-211` | Опус | — |
| К-12 | 6 экспортов `stemTypes` после D-1 становятся мёртвым API (не ошибкой) | `ROLE_ROUTING:41`, `SOFT_RESYNC_DEFAULTS:435`, `LOOP_PRE_SEEK_MAX_MS:498`, `LOOP_PRE_SEEK_DURATION_RATIO:499`, `LOOP_PRE_SEEK_TIMEOUT_MS:500`, `RoutingTarget:30` — вне кластера **0** использований; re-export в `stem/index.ts:11,27,32,34,35,36` | Опус | `src/` |
| К-13 | `StemRole` — **живой**, остаётся | 10 использований вне кластера, напр. `wrappers/mode-events.ts:6,9` | Опус | `src/` |

**НЕ ПРОВЕРЕНО (честный список для 002/009):**
- Рантайм-поведение после сноса **на живом браузере** — только смоук Никиты может закрыть. Статически доказано лишь отсутствие кода в бандле.
- `js/*.js` (5 файлов) как «frozen» из дока — в волну **не входят** и не анализировались на живость в этом паке (кроме факта: `audio-facade-v3.js` живой, `index.html:399`).
- Изменение размера чанков `dist/` после D-0b — не измерялось.

---

## §2 · СОЗВЕЗДИЕ: топология (развилка ① — принята)

```
AudioEngineV2.ts (2178)              ← 0 импортёров во всём репо
  ├→ StemPlayer.ts (210)             ← единственный импортёр: AudioEngineV2.ts:8
  │    └→ AudioLoader.ts (110)       ← единственный импортёр: StemPlayer.ts:8
  ├→ VocalMix.ts (88)                ← единственный импортёр: AudioEngineV2.ts:9
  └→ MicrophoneManager.ts (149)      ← единственный импортёр: AudioEngineV2.ts:10
                          Σ 2735 строк, снаружи не входит ни одна ссылка

audioContext.ts (35)                 ← 🟢 ЖИВОЙ, 9 импортёров — В ВОЛНУ НЕ ВХОДИТ (К-4)
```

**Почему созвездие целиком, а не только монолит:** риск идентичен (кластер замкнут, в бандле нет — К-1/К-2), выигрыш +557 строк и −3 ошибки tsc. Главное: четыре спутника числятся «Permanent frozen» в `docs/architecture/frozen-zones-v2.md:19-22`, но **отсутствуют в `frozen-manifest.json`** ⇒ `verify:frozen` их не охраняет. Оставить их = сохранить ложь дока после закрытия программы.

**Обратные зависимости кластера (в снос идут вместе с ним):** `AudioEngineV2.ts:11-12` тянет типы и константы из `stem/stemTypes.ts`. Сам `stemTypes.ts` **живой** — не трогать; но 6 его экспортов после D-1 остаются без потребителей (К-12). Это **не ошибка tsc** (экспорты не дают TS6133) и **не блокер волны** — кандидат на отдельный микропак после D-4, чтобы не смешивать снос с чисткой API.

---

## §3 · МАРШРУТ: 7 шагов, каждый зелёный

### D-0 · Гейты ПЕРЕД хирургией (warn-режим)

| Гейт | Что | Почему до волны |
|---|---|---|
| **G-4 `verify:refs <path>`** (~10 строк) | все ссылки на путь **вне `src/`**: скрипты, `.github/`, `*.json`, `package.json` | ровно этот гейт нашёл бы ловушку CHECK-D (К-7). **Обязательная строка в каждом MICRO-PACK волны:** «ссылки вне src: …» |
| **G-1 `verify:reach`** (~60 строк, 0 зависимостей) | обход графа импортов от `index.html`-скриптов + `src/main.tsx`; печатает недостижимые файлы | страхует от повторения ошибки «пилот в мёртвом файле»; даёт машинный ответ на вопрос «этот файл вообще исполняется?» |

Оба **только `warn`** (отчёт, не падение). Переключение в `fail` — шаг D-4, после недели зелени.

### D-0b · CaptureWorklet-пак (развилка ② — принята, ДО волны)

Два `cp` из `docs/modernization/handoff/`, оба файла уже написаны и содержат обоснование безопасности внутри себя:

```
docs/modernization/handoff/new-files/src/types/audio-worklet-global.d.ts
  → src/types/audio-worklet-global.d.ts                              (объявления AudioWorkletProcessor/currentFrame/registerProcessor)

docs/modernization/handoff/src/audio/engine-v3/diagnostics/CaptureWorklet.ts
  → src/audio/engine-v3/diagnostics/CaptureWorklet.ts                (+15 объявлений полей класса, diff 22 строки, всё аддитивное)
```

**Почему рантайм не меняется:** `.d.ts` полностью стирается при сборке; аннотации полей исчезают до того, как функция сериализуется через `toString()` в `AudioWorkletGlobalScope`. Обоснование дословно записано в шапке самого d.ts.

**Гейты D-0b:** tsc **282 → 202** (эмпирика К-9) · vitest 811/68 Δ0 · `build OK` · `verify:ci` PASS · `frozen 2/2` не тронут.
**Отдельным коммитом, не внутри волны** — иначе канон-цифры волны станут нечитаемыми.

### D-0c · Три живых бага (развилка ③ — принята: после D-0b, до D-1)

Не входят в де-фриз, но встают здесь по решению Никиты. Каждый — юзер-видимый, каждый доказан:

| Баг | Диагноз (file:line) | Куда подключать |
|---|---|---|
| **Мик-фейдер не двигает звук** | `js/audio-facade-v3.js:85` — `setMicrophoneVolume() {}` пусто. Зовут `ControlDeck.tsx:458,468` (живой в бандле). `micVolume` пишется в store и рисуется ⇒ ползунок ездит, цифра меняется, громкости нет | `MonitorRouter.setMicMonitor(on, volume):161` / `setMonitorVolume(v):231` |
| **Аудио-реактивный визуал мёртв целиком** | `wrappers/audio-reactive.ts:38-45` цепляет analyser к `ae.stereoMerger` / `ae.instrumentalGain` — **ни одного нет в фасаде** ⇒ `console.warn`, analyser не подключён ⇒ `--bl-audio-energy/bass/mid/high/beat` всегда 0. Потребители: Билли `useBillyAudioReactive.ts:70-74`, рот аватара `avatar.css:65`, подсветка BPM `BpmButtons.module.css:259-267` | `__belive.pipeline.getStemAnalyser(...)` или программный тап `MonitorRouter` |
| **Восстановление громкостей после прерывания упражнения мертво дважды** | `exercise.interruption.ts:98` зовёт `ae.setVolumes` (**нет в фасаде**) и пишет в `audio.store` поля `instrumentalVolume/vocalsVolume`, которые **удалены** — `audio.store.ts:12` дословно «REMOVED — use stem.store.stemVolumes instead» | `useStemStore.setStemVolume` (store уже доводит до pipeline через `stem-engine-sync.ts:136`) |

Каждый = отдельный коммит + смоук Никиты (жест → результат). Формально это не Волна D — при нехватке времени вырезается без последствий для маршрута.

### D-1 · Созвездие + манифест АТОМАРНО

```
удалить: src/audio/core/AudioEngineV2.ts · StemPlayer.ts · AudioLoader.ts · VocalMix.ts · MicrophoneManager.ts
удалить в ТОМ ЖЕ коммите: строку guard "src/audio/core/AudioEngineV2.ts" из frozen-manifest.json
НЕ трогать: src/audio/core/audioContext.ts (К-4)
```

**Почему атомарно:** `check-frozen.mjs` сам это требует — при отсутствии файла печатает *«легальный снос обязан удалить манифест-строку в том же коммите»* и падает.

**Гейты D-1:** `rg "AudioEngineV2|StemPlayer|VocalMix|MicrophoneManager" dist/` = 0 (после `npm run build`) · tsc **202 → 192** (−10 от D-0b-базы) · vitest 811/68 Δ0 · PARITY Δ0 · `frozen OK: 1/1` · `verify:refs` по каждому из 5 путей = только комментарии/доки.

**Комментарии-упоминания (не блокеры, идут в конвой D-5):** `src/stem/stemTypes.ts:520` («This invariant is enforced in AudioEngineV2.setStemMute()») · `src/components/MixerPanel.tsx:6` · `src/character/sound/CharacterSoundManager.ts:2` · `src/foundation/event-bus/README.md:55-58` · `V3StatePublisher.ts:128,154` · `V3DataInterceptor.ts:217,223` · `TransportV3.ts:262,279` · `wrappers/position-sync.ts:38` · `js/audio-facade-v3.js:22`. **16 вхождений вида `AudioEngineV2.ts:NNNN` в доках НЕ вычищать** — это спецификация паритета V2→V3 (директива подтверждена, PRE-D §D3.2).

### D-2 · liveMode-фантом ШЕСТЕРНЁЙ (шесть точек в одном коммите)

```
1. удалить  src/bridges/live-guard.ts                        (21 строка)
2. удалить  main.tsx:6   import { installLiveGuard } ...
3. удалить  main.tsx:317 installLiveGuard();
4. удалить  mode-switch.service.ts:20      (deactivateLiveIfActive: const lm = ...liveMode)
   удалить  mode-switch.service.ts:209-211 (activateLive: liveMode.activate())
   удалить  notification.ts:21-22          (Priority-2; Priority-3 DOM-тост ЖИВОЙ — остаётся)
5. удалить  запись "live-guard" из bridge-manifest.json:25
6. удалить  блок CHECK-D из scripts/verify-bridge-parity.ts:225-235 + строку 15 в шапке-описании
```

**Пропуск любой из шести = красное.** Пропуск №6 = **PARITY FAIL = обрыв деплоя на push в main** (К-7).
**НЕ трогать `index.html:233`** (К-11).

**Гейты D-2:** `npm run verify:parity` **PASS перепроверить обязательно** (изменён сам скрипт) · `frozen OK: 0/0`, exit 0 (К-10) · tsc 192 (Δ0, файл без ошибок) · vitest Δ0 · `rg "liveMode" src/` = 0.

### D-3 · Упразднение замка — ТОЛЬКО это в коммите

```
удалить: scripts/check-frozen.mjs · frozen-manifest.json
удалить: package.json:25  "verify:frozen": "node scripts/check-frozen.mjs"
удалить: .github/workflows/deploy.yml  шаг "Verify Frozen Zones"
```
Ссылок на `verify:frozen`/`check-frozen` вне этих двух мест **нет** (проверено грепом по репо без `node_modules`/`*.md`).

**Единственный шаг волны с blast-радиусом на прод:** сам `deploy.yml` ничем не покрыт, ошибка = обрыв деплоя для всех. Ничего другого в этот коммит не кладём.

⚠️ **Побочный эффект, который надо назвать:** `check-frozen.mjs:38-56` содержит рекурсивный WARN-обход `src/bridges/` («resurrection: файл вне манифеста»). После D-3 этот сторож исчезает ⇒ новый мост в `src/bridges/` больше никто не заметит. Функцию переносим в G-1/G-2 (D-4) либо принимаем потерю осознанно — решение 001.

### D-4 · ЗАМЕНА ЗАМКА (программа закрывается гейтом, а не пустотой)

- G-1 `verify:reach` → **fail**
- G-2 `verify:contract` (~40 строк): вызовы членов `window.audioEngine`, которых нет в фасаде. Сегодня показывает **54 обращения к 21 несуществующему члену** — каждое либо с причиной в allowlist, либо красное
- WARN-обход `src/bridges/` из `check-frozen.mjs` переезжает сюда
- в `verify:ci` появляется проверка **живости**, а не только регрессии

Без D-4 программа де-фриза заканчивается тем, что репо становится чище **и слепее**.

### D-5 · Конвой доков

Живёт в `MICRO-PACK-DOCS-REFORM` §R-6. Ключевое: `docs/architecture/frozen-zones-v2.md` → `history/` целиком (развилка ④ — принята), 589 упоминаний frozen массово **не** переписывать (урок B++).

---

## §4 · ИТОГ ПРОГРАММЫ

| Метрика | До D-0b | После D-4 |
|---|---|---|
| `tsc` | 282 | **~192** (−80 CaptureWorklet, −10 созвездие) |
| строк мёртвого кода снесено | — | **2756** (2735 созвездие + 21 live-guard) |
| нарастающим с Волны A | −4360 | **−7116** |
| `frozen` | 2/2 | **упразднён** |
| гейты живости в CI | 0 | **2 (G-1, G-2)** |
| `vitest` | 811/68 | 811/68 (Δ0 на всех шагах) |

---

## §5 · ЧТО МОЖЕТ ПОЙТИ НЕ ТАК (сырьё для 002; полный pre-mortem — отдельным отчётом О-3)

1. **D-2 пропускает одну из шести точек** → PARITY FAIL → обрыв деплоя. Защита: шестерня как чек-лист в коммит-сообщении + `verify:parity` в гейтах шага.
2. **D-3 ломает `deploy.yml`** → прод-деплой мёртв для всех. Защита: коммит-одиночка + прочитать YAML глазами до пуша.
3. **D-0b меняет рантайм ворклета** (гипотетически, если бандлер поведёт себя иначе, чем ожидается). Защита: смоук диагностики + сравнение `dist` чанка диагностики до/после.
4. **Смоук Никиты не проводится**, и статическая уверенность принимается за рантайм-правду. Защита: К-1..К-13 честно помечены «не проверено в браузере» (§1).
5. **G-1/G-2 в `fail` слишком рано** → блокируют деплой на ложном срабатывании. Защита: неделя `warn` без исключений.
6. **После D-3 исчезает сторож `src/bridges/`** и это никто не замечает. Защита: явный пункт D-4.

---

*Опус-5 · MICRO-PACK-DEFREEZE-D-FINAL v1.0 · самодостаточно для 001 (круг-1), 002 (удары) и 009 (суд): каждое число — карточка клейма в §1 с полем «проверено». Список «НЕ ПРОВЕРЕНО» — часть спеки, не оговорка.*
