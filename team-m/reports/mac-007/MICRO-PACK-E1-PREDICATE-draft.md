> **СТАТУС Ф002 (007_Мак, 25.08): стресс-проверен 10/10 клеймов по file:line. R1 (Interceptor:169 без generation-check) ЭСКАЛИРОВАН Ц3. Готов к Оператору после ратификации Hub.**

# MICRO-PACK-E1 · PREDICATE CANONIZATION · draft (design-only) 
Автор: mac-007 / роль Ф001 Со-Архитектор · 2026-08-25
Статус: DRAFT для Ц3. Кода не трогал (read-only по src/). Единственный writer плана — этот файл.
Входы: team-m/E1-PREDICATE-INVENTORY-2026-08-25.md, docs/PLAN-v3.3-CANONICAL.md §1/§2/§3, src-файлы (см. ссылки).
Правило PLAN §2 соблюдено: frozen-зона (AudioEngineV2, patchV1, bridges/*, track.orchestrator, _-поля, vendor WASM) не затрагивается ни одной правкой.

---

## §1. РЕШЕНИЕ

### 1.1 Канон: `window.__v3Active` (flag), единственный writer — `window.__setV3Active` (`src/main.tsx:148–151`)

**Аргументация «flag через __setV3Active» vs «getter»:**

1. **Sole-writer уже верифицирован** (инвентарь §5): все production-переходы true/false/rollback идут только через `__setV3Active` — драйвер `V3DataInterceptor.loadTrack` (`:68` reset, `:152` Zombie Kill Switch, `:169` rollback). Канонизация getter'а потребовала бы строить новый writer с нуля.
2. **Семантики не совпадают, и это решает:** getter `TransportV3.isV3Active` (`src/audio/engine-v3/core/TransportV3.ts:98–100`) возвращает `_pipelineController !== null` — pipeline прикрепляется при буте и НЕ отщёлкивается false на перезагрузку трека. Флаг же живёт циклом track-lifecycle: false в начале `loadTrack` (:68), true после успешного auto-play (:152), false на rollback (:169). Все 28 ридеров завязаны именно на track-lifecycle; перевод их на getter изменил бы поведение на каждой смене трека (флаг false во время загрузки → гард открыт; getter true всегда → гард закрыт навсегда). Это behavior change вне мандата E1.
3. **Getter мёртв:** 0 консьюмеров (инвентарь §1). Канонизировать имя без потребителей = плодить второй source of truth.
4. **Frozen/дист-контракт:** инвентарь §6.5 — Frozen потребляет предикат только через published window flag; dist bundle несёт идентичный single-writer shape. Window flag доступен в module-contexts и event-bus wrappers до/вне создания transport-инстанса; getter требует ссылки на TransportV3.

### 1.2 Судьба алиасов

| Алиас | Где | Решение |
|---|---|---|
| `isV3Active` (getter) | `core/TransportV3.ts:97–100` | **DELETE целиком** (коммент :97 + getter :98–100). 0 writers, 0 consumers → депрекейшн-шина не нужна, codemod не нужен. Ожидаемый tsc-delta: 0. |
| `isV3Master` (pure fn) | `foundation/reactions/stem-engine-sync.ts:21–25`, вызовы `:74/:122/:227` | **Коллапс чтения в канон**: тело оставляем (сохраняем dual-guard семантику), но flag-атом внутри читается через канон-аксессор; fn помечается `@deprecated M5` (после удаления V2 коллапсирует в константу — инвентарь §4). Экспортов нет (module-private), поэтому переименование не требуется — имя умирает вместе с файлом на M5. Альтернатива B (если Ц3 хочет жёстко одно имя): инлайнить тело в 3 вызова и удалить fn — дифф тот же файл, минус 5 строк. |

### 1.3 Единый read-path (второе плечо канонизации)

Одного writer мало — 28 ридеров сегодня читают флаг сырыми `(window as any).__v3Active` кастами (дрейф-поверхность). Вводим **один типизированный аксессор**, единственное место в src/ вне main.tsx, упоминающее сырое имя:

```ts
// src/foundation/predicate/v3-active.ts (НОВЫЙ файл, ~10 строк)
// E1 canon: единственный writer — window.__setV3Active (main.tsx:148–151).
// Этот модуль — единственный разрешённый read-path. Сырые касты запрещены.
export function getV3Active(): boolean {
  return (window as any).__v3Active === true   // undefined/garbage => false (pre-boot safe)
}
```

- Прецедент размещения: E0 уже делал foundation-синк; `foundation/` не входит в frozen-перечень PLAN §2 (frozen = AudioEngineV2, patchV1, bridges/*, track.orchestrator, _-поля, vendor WASM).
- Setter-обёртка НЕ вводится: production-writer остаётся ровно один — `main.tsx:150`; драйвер продолжает звать `__setV3Active?.()` как сегодня (`V3DataInterceptor.ts:66/68/106/152/169` стиль уже опционален).
- Dual source of truth сохраняется по инвентарю §6.1: interceptor читает module-local `_v3Active` (main.tsx:131/136/140), все остальные — window flag; пара пишется синхронно в одном closure (:149–150). E1 эту пару НЕ трогает.
- Опционально (решение Ц3): DEV-only trace внутри writer — `if (import.meta.env.DEV) console.info('[E1] v3Active', prev, '→', active)`; даёт трейс-дифф для CDP-верификации без прод-шума.

### 1.4 W1/W2 роли (без дублирования writer'а)

- `W1 main.tsx:132` `(window as any).__v3Active = false` — bootstrap-default ДО появления любого ридера/драйвера; остаётся, помечается комментарием «E1: bootstrap default, не writer #2». PLAN §4(b)-требование («продлить main.tsx:132–142, не дублировать в V2Adapter») соблюдено: никакого второго writer в V2Adapter/interceptor не появляется.
- `W2 main.tsx:148–151` — THE writer. Тело не меняется (минимальный дифф); опционально DEV-trace из §1.3.

---

## §2. EDITS: 16 файлов / 28 сайтов (+writer-zone, +алиасы)

Минимальный дифф на каждый сайт: атом `(window as any).__v3Active` → `getV3Active()`, сверху файла `import { getV3Active } from '<rel>/foundation/predicate/v3-active'`. Fallback-arm'ы dual-guard'ов (`|| transport.state !== 'idle' && orchestrator.all().length > 0`) остаются дословно — паритет поведения, смерть arm'а по расписанию M3/M5 (§3).

### G0. Writer zone (не ридеры)
| Файл:строка | Было | Будет |
|---|---|---|
| main.tsx:132 | `;(window as any).__v3Active = false` | без изменения кода; + комментарий «E1: bootstrap default» |
| main.tsx:148–151 | `__setV3Active = (active) => { _v3Active = …; __v3Active = … }` | без изменения; опц. DEV-trace (§1.3) |
| V3DataInterceptor.ts:68 / :152 / :169 | `__setV3Active?.(…)` | без изменения (уже канон-вызовы) |

### G-A. Keyboard (4 сайта)
| Файл:строка | Было | Будет |
|---|---|---|
| useKeyboardShortcuts.ts:46 | `(window as any).__v3Active \|\| (transport.state !== 'idle' && …)` | `getV3Active() \|\| (…)` — только атом |
| useKeyboardShortcuts.ts:58 | `if ((window as any).__v3Active) return` | `if (getV3Active()) return` |
| useKeyboardShortcuts.ts:81 | как :46 | как :46 |
| useKeyboardShortcuts.ts:89 | как :58 | как :58 |

### G-B. Event-bus wrappers (6)
| Файл:строка | Было | Будет |
|---|---|---|
| loop-events.ts:27 | dual-guard атом | `getV3Active() || (…)` |
| loop-events.ts:52 | `!!(t3 && (__v3Active \|\| …))` | `!!(t3 && (getV3Active() \|\| …))` |
| loop-events.ts:92 | как :52 | как :52 |
| audio-events.ts:76 | `if (!(window as any).__v3Active)` | `if (!getV3Active())` |
| audio-events.ts:112 | `st.stemsEnabled && !(__v3Active)` | `st.stemsEnabled && !getV3Active()` |
| position-sync.ts:45 | dual-guard атом | `t3 && (getV3Active() \|\| (…))` |

### G-C. Services (1)
| Файл:строка | Было | Будет |
|---|---|---|
| trigger-visual.service.ts:55 | dual-guard атом | `getV3Active() \|\| (…)` |

### G-D. UI components (11)
| Файл:строка | Было | Будет |
|---|---|---|
| TransportBar.tsx:41 | dual-guard атом | атом → `getV3Active()` |
| WagonTrain.tsx:107 | dual-guard атом | атом → `getV3Active()` |
| WagonTrain.tsx:132 | dual-guard атом | атом → `getV3Active()` |
| WaveformCanvas.tsx:440 | `const v3Active = (__v3Active) \|\| (t3 && state!=='idle')` | первый атом → `getV3Active()` |
| MixerPanel.tsx:149 | `if ((window as any).__v3Active)` | `if (getV3Active())` |
| ControlDeck.tsx:63 | `const __v3Active = !!((__v3Active))` | `const __v3Active = getV3Active()` (локальная переменная и её ридер :65 не переименовываем — минимальный дифф) |
| ControlDeck.tsx:195 | `const __v3 = (__v3Active)` | `const __v3 = getV3Active()` |
| ControlDeck.tsx:216 | как :195 | как :195 |
| RehearsalLyrics.tsx:494 | `(__v3Active) && typeof t3 === 'number'` | `getV3Active() && typeof t3 === 'number'` |
| TakesPanel.tsx:676 | как RehearsalLyrics:494 | как там |
| main.tsx:279 (H4.1 mini-gard) | `if ((window as any).__v3Active)` | `if (getV3Active())` |

### G-E. Takes time utils (4)
| Файл:строка | Было | Будет |
|---|---|---|
| takes.time.ts:12 | `if ((__v3Active))` | `if (getV3Active())` |
| takes.time.ts:25 | как :12 | как :12 |
| takes.time.ts:34 | как :12 | как :12 |
| takes.time.ts:42 | как :12 | как :12 |

### G-F. DEV telemetry (1)
| Файл:строка | Было | Будет |
|---|---|---|
| TakesControlStrip.tsx:312 | `v3Active: (window as any).__v3Active,` | `v3Active: getV3Active(),` (значение payload идентично) |

### G-G. Sync bridge (1 скрытый ридер)
| Файл:строка | Было | Будет |
|---|---|---|
| stem-engine-sync.ts:24 | `return !!(t3 && ((__v3Active) \|\| t3.orchestrator.all().length > 0))` | flag-атом → `getV3Active()`; fn получает `@deprecated — M5: коллапс в константу` ; вызовы :74/:122/:227 НЕ трогаем |

### G-H. Alias deletions (2 имени)
| Файл:строка | Было | Будет |
|---|---|---|
| core/TransportV3.ts:97–100 | коммент «009: публичный getter…» + `get isV3Active(): boolean { return this._pipelineController !== null }` | DELETE (0 writers, 0 consumers — инвентарь §1) |
| foundation/reactions/stem-engine-sync.ts:21–25 | `function isV3Master()` | сохранить (G-G), `@deprecated M5`; вариант B — инлайн в :74/:122/:227 и delete |

**Сводка:** 28/28 ридеров переведены на единый read-path; writer остаётся один; оба alias-имени удаляются/депрекейтятся. Сверка с инвентарём: «16-й файл» из §2 инвентаря = stem-engine-sync.ts:24 (ридер спрятан внутри isV3Master); ControlDeck:65 — производное чтение локальной константы (не считается); main.tsx:267/:338 — комментарии. Нерешённые якоря плана (389-G1..G4, «8+ ридеров :373») в дереве не резолвятся — фактические кандидаты покрыты строками выше (см. Unresolved в инвентаре §7).

---

## §3. КОЛОНКИ ПЛАНА (PLAN §1 E1): «какой режим покрывает» × «умирает на M5»

| Группа | Сайты | Какой режим покрывает | Умирает на M5? |
|---|---|---|---|
| G-A Keyboard | keyboard :46/:58/:81/:89 | ОБА режима (V3-flag ∨ legacy-orchestrator guard) | Частично: V2-arm умирает на M3 (ретир V2-recovery); сам сайт переживает M5, схлопывается в чистый flag-read |
| G-B loop/position | loop-events :27/:52/:92, position-sync:45 | ОБА режима, dual-guard | Частично: V2-arm → M3; сайты переживают M5 |
| G-B audio-events | audio-events :76/:112 | Гард осмыслен только пока жив V2-routing (MP-19 parity) | Да, раньше M5: цель истекает на M3, к M5 сайта нет |
| G-C trigger-visual | :55 | ОБА режима | Частично: V2-arm → M3; переживает M5 |
| G-D transport-UI | TransportBar:41, WagonTrain:107/:132, WaveformCanvas:440 | ОБА режима | Частично: V2-arm → M3; переживают M5 |
| G-D mixer/deck | MixerPanel:149, ControlDeck:63/:195/:216 | ОБА режима (dual-mode routing H3.4/H4.x) | Частично: legacy-arm → M3; переживают M5 как unconditional-V3 |
| G-D takes-time/rate | takes.time ×4, TakesPanel:676, RehearsalLyrics:494 | V3-primary + V2-cache fallback | Частично: fallback-arm → M3; сайты переживают M5 (V3-only) |
| G-F telemetry | TakesControlStrip:312 | Диагностика обоих режимов (поле v3Active в truth-capture) | Кандидат на ранний ретир (DEV-only ценность); к M5 не доживает или переживает как V3-native телеметрия — решение Ц3 |
| H4.1 mini-gard | main.tsx:279 | Гард ae.* surface при активном V3 | ⚠️ Undecided (Ц3): судьба связана с B-slice revival + H4.1 extension (инвентарь §6.3); E1 меняет только атом чтения |
| G-G sync bridge | stem-engine-sync:24 (через isV3Master :74/:122/:227) | Арбитраж V3/V2 мастера | Частично: orchestrator-arm → M3; сама fn коллапсирует в константу на M5 → удалить вместе с именем isV3Master |
| G-H aliases | TransportV3:98 getter | Никакой (мёртвый) | Умирает сейчас (E1), не доживая до M3/M5 |

---

## §4. ТЕСТЫ

Тест-канон базы 25.08: **tsc 313 / vitest 769** (PLAN §2). Обе фикстуры пишут флаг raw-присваиванием мимо writer (13 writes, benign по инвентарю §5, но ломают доктрину single-writer и рассинхроняют `_v3Active`-twin контракт).

### BusFader18.test.ts (`audio/engine-v3/pipeline/__tests__/`)
Raw writes: :384, :390, :407, :411, :428, :474, :477(afterEach), :480, :492, :503; raw reads в контракт-зеркале: :370 (installGuard), :450 (routeInstFader). Правки:
1. В `beforeEach` обоих describe (:383–386, :470–475) — ставить канон-writer stub вместо raw-присваивания:
   `;(window as any).__setV3Active = (a: boolean) => { (window as any).__v3Active = a }`
2. Все присваивания заменить на `__setV3Active(true/false)` (эмуляция контракта пары `_v3Active`+flag из main.tsx:148–151).
3. Зеркала :370/:450 читать через `getV3Active()` — зеркала обязаны следовать за prod-гардом main.tsx:279 (иначе тест перестанет ловить его дрейф).
4. afterEach :388–391/:477 — сброс через stub + `delete (window as any).__setV3Active`.
Контроль: cage-инвариант-тест (:424–438) должен продолжать проходить — он фиксирует, что гарду всё равно, кто канал (ae.* vs V2Adapter).

### stem-engine-sync.test.ts (`foundation/reactions/__tests__/`)
Raw writes: :112 (afterEach), :134, :147. Правки:
1. Тот же stub-writer в setup/afterEach, вызовы через `__setV3Active(...)`.
2. Добавить 1 микротест контракта аксессора (новый describe, ~10 строк): `undefined → getV3Active()===false`, `true → true`, `'yes'/1 → false` (strict `=== true`). Это фиксирует pre-boot безопасность (Risk R2).
3. Опционально: тест, что `isV3Master()` читает канон (stub __setV3Active(false)+orchestrator пуст → false; flag true → true).

### Учёт канона
vitest: 769 → 769+N (N=1..2 новых) — рост за счёт новых тестов, регрессией не считать; зафиксировать А4-строкой «tsc N / vitest passed M, files X/Y, Z legacy load-error». tsc: удаление мёртвого getter'а + новые импорты → ожидание 0 дельты против 313; любое новое имя ошибки = стоп и разбор (PLAN §2).

---

## §5. RISKS (топ-5)

**R1 · Race Zombie Kill Switch (`V3DataInterceptor.ts:152` ↔ `:68`/`:169`).** Rollback-catch (:166–178) выполняется без проверки `myGeneration === this._loadGeneration`: если во время 5s-play-timeout (:159–164) началась новая загрузка трека (generation bump на :64), старый rollback всё равно щёлкнет `__setV3Active(false)` → окно «V3 играет, флаг false» → V2Interceptor разблокирован, zombie-риск. E1-минимальная защита: перед :169 добавить generation-check (одна строка, поведение меняется только в race-ветке — потребуется proof-of-change по PLAN §2). Либо вынести в follow-up micro-pack — решение Ц3; E1 без этой строки race НЕ лечит, только канонизирует имена.

**R2 · Порядок инициализации W1/W2.** До `bootAether` (`main.tsx:88`) флага нет вовсе: `window.__v3Active === undefined`. Все текущие сырые чтения falsy-safe; аксессор `=== true` сохраняет паритет (§4 тест-контракт). Обратный порядок (:148 раньше :132) невозможен и не нужен. HMR-риск: повторный boot переопределяет `__setV3Active`; сохранённая кем-то старая ссылка писала бы в отвязанный `_v3Active`-twin. Митигация (опц., DEV): tamper-warn при redefine writer'а. Production-инициализация одна и линейная — риск низкий.

**R3 · DEV-telemetry `TakesControlStrip.tsx:312`.** Поле `v3Active:` попадает в truth-capture payload; замена атома на `getV3Active()` значение не меняет, но если Ц3 примет DEV-trace из §1.3, объём консоли вырастет — следить, чтобы telemetry-диффы не путали с поведенческими. Также CDP-проверки (§6) должны ждать то же имя поля.

**R4 · Фикстуры мимо writer (13 raw writes).** Если оставить как есть, «канон» будет фиктивным: тесты продолжат тренировать паттерн, который E1 запрещает. Обязательно исполнить §4; иначе следующий pack снова получит рассинхрон twin-контракта.

**R5 · Frozen-check.** Ни один правимый файл не лежит в frozen-перечне: bridges/* не содержит ридов `__v3Active` (grep по src/ — 0 файлов под bridges/); AudioEngineV2/patchV1/track.orchestrator/_-поля не открываются; stem-engine-sync сам декларирует «❄️ Frozen: 0 задето» и правится только в атоме :24. Дист-bundle: инвентарь §6.5 подтверждает identical single-writer shape; после E1 обязателен dist-grep (§6, п.4). Метод frozen-верификации: grep-инвентарь + diff-scope (файлы §2 исчерпывающе перечислены), не «FROZEN-OK».

---

## §6. VERIFY-ЧЕКЛИСТ (Near Light)

Статика:
1. `tsc` = 313 (0 новых имён ошибок вне known-ts-errors) · `vitest` ≥769 passed, формулировка А4 единая (PLAN §2).
2. Grep-канон после правок: сырые `(window as any).__v3Active` в проде остаются ТОЛЬКО в `foundation/predicate/v3-active.ts` (аксессор) + `main.tsx:132/:150` (writer-zone); `grep -rn "isV3Active" src/ | grep -v test` → 0 хитов; `isV3Master` → только stem-engine-sync.ts (либо 0 при варианте B).
3. Writer-count: `__setV3Active =` определяется ровно 1 раз в src/ (main.tsx:148); в test-фикстурах — только stub'ы §4.
4. dist-grep (методика M3-VERIFY шаг 10, esbuild, mangle-props нет): minified бандл несёт тот же single-writer shape — 1 определение сеттера, чтения через единственный аксессор; positive-контроли первыми (getStemMeterLevel, 'loopcompleted', 'audioglitch').

CDP-драйв (🟢):
5. Boot: `typeof window.__setV3Active === 'function'`, `window.__v3Active === false` (или undefined до бута — задокументировать наблюдаемое).
6. Загрузка трека: последовательность false (:68) → true (:152) видна в консоли ('[V3DataInterceptor] 🎯 Auto-play V3 at …'); между ними V2.play() блокируется ('[V2Interceptor] 🚫 V2.play() blocked').
7. Rollback-путь: инъекция таймаута → флаг возвращается в false + событие `belive:v3-activation-failed` диспатчится (V3DataInterceptor.ts:169/:176).
8. Telemetry: поле `v3Active` в truth-capture (TakesControlStrip:312) отражает переходы 6–7.
9. Keyboard Space при активном V3: ранний return по канону (:58/:89), V2-fallback не срабатывает.
10. Переключение трека при игре: флаг мигает false→true, гард H4.1 (main.tsx:279) глушит ae.* в окне активности (DEV-warn однократный на метод).

Уши (✅, юзером): solo/mute-инвариант, Inst-фейдер dual-mode (H3.4), takes-trim — по регламенту M4; E1 не меняет поведение, любые слышимые отличия = регрессия, стоп.

Зависимости/секвенс: E1 независим от E2/E3; выполнять ДО B-slice revival (инвентарь §6.4: продление гарда H4.1 «must use E1-canonicalized writer») и до M3-VERIFY шага 12.

---
— draft окончен · mac-007 · design-only, src/ не тронут
