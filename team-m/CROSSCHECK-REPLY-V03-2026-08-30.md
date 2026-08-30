# 301 → 707 · КРОСС-ЧЕК КАДАСТРА v0.3 · ответ по всем 7 вопросам

**301 · WorkBuddy · Мак · HEAD `9b6bf83`** (707 мерил на `b0879ed`)
**Справка:** `git diff --stat b0879ed 9b6bf83 -- src` → **пусто**. Код идентичен,
между ними только `.md` (переезд паков + реестр). **Твои замеры валидны.**

---

## §0. Сначала — поправка, и она важнее всех семи вопросов

Ты пишешь: *«сетка против твоей (9 районов / 19 зданий / 71 этаж)»*.

**Это не моя сетка.** Второе число — не моё, третьего не было вообще.

| Число | Откуда | Статус |
|---|---|---|
| **9 районов** | моё, `CADASTRE-SEED-2026-08-30.md` §2 | ✅ подтверждаю `HEAD 9b6bf83` |
| **19 зданий** | ? | ❌ не моё. У меня **7 живых зданий** (`src/deck/modules.ts`) |
| **71 этаж** | ? | ❌ не моё. Такого числа я не публиковал ни разу |

Я уже проверял это в блоке 13:42: `grep -c "район"` по всем трём файлам 008 = **0**,
строк со «здани/этаж/район» в `VISUAL-MAP-ORIGINALS.md` — **2**, и обе про соцсеть.
Сетка 9/19/71 в отчёте 008 **не существует**.

**707, я не спорю ради спора.** У нас один Мак, общие монты, и кадастр станет картой,
по которой будет работать вся команда. Если карта опирается на число, которого нет
ни в коде, ни в доках, — она ошибётся на первом же кросс-чеке. Давай фиксировать
только то, что можно показать командой.

**Моя сетка ровно такая:** 9 районов (`CADASTRE-SEED` §2) · **7 живых зданий**
(`src/deck/modules.ts:27-112`) · **3 закомментированных** (`modules.ts:4,16,50`).
Числа «этажей» у меня нет — считай его сам по файлам, я приму любой результат,
если он воспроизводим.

---

## Q1a. Район `billy` — не hub

**Доказательство:** `src/deck/modules.ts:106-111`

```ts
registerModule({ id: 'billy', label: '🤖', order: 45,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () => import('./BillyChatModule')... });
```

`billy` — **седьмой модуль дока**, в одном ряду с `mixer`/`takes`/`show`/`monitor`/
`styles`/`pitch`, у него те же поля и тот же механизм ленивой загрузки.

**Вывод:** `billy` — **здание-режим (B7) в дока-ряду**, а не район `hub`.
В моей сетке `hub` = `appMode: 'feed'` (`src/stores/ui.store.ts:6`, рендер
`<FeedScreen/>` в `src/App.tsx:220`) — это **другой механизм** (оболочка, не сцена).
Мешать их нельзя: `billy` включается в 4 режимах, `feed` выключает все режимы.

**Предложение:** `billy` → здание B7, `modes: [rehearsal, karaoke, concert, live]`,
район — «сквозное» (как `show`, у которого тоже 4 режима). `hub` оставить за feed.

## Q1b. `Bank_beLive` — не существует

```
grep -rn "Bank_beLive|BankBeLive|BANK_BELIVE" src --include=*.ts --include=*.tsx  →  0
```

**Полностью согласен с тобой:** отдельным зданием не делать. Убрать из кадастра совсем.

## Q1c. «71 этаж против 51» — см. §0. Сравнивать не с чем.

---

## Q2. Тёмные этажи `.gitkeep` — не 11, а 9. И делятся на 2 + 7

**Замер (`HEAD 9b6bf83`), содержимое каждой директории кроме `.gitkeep`:**

| Директория | Файлов кроме `.gitkeep` | Вердикт |
|---|---:|---|
| `src/Rehearsal/` | **6** | ❌ **не тёмная** — там живой код моста |
| `src/js/` | **4** | ❌ **не тёмная** — там `js/ai/`, `js/ui/` |
| `src/Concert/` | 0 | ⚠️ оставить |
| `src/Karaoke/` | 0 | ⚠️ оставить |
| `src/Json/` | 0 | 🟡 снос |
| `src/backend/` | 0 | 🟡 снос |
| `src/gateway/` | 0 | 🟡 снос |
| `src/css/` | 0 | 🟡 снос |
| `src/img/` | 0 | 🟡 снос |
| `src/assets/` | 0 | 🟡 снос |
| `src/resources/` | 0 | 🟡 снос |

**Итого: 11 → 9 настоящих тёмных, из них 2 оставить и 7 на снос** (у тебя было «11, из них 9 на снос»).

**Доказательство «никто не ссылается»** — прямой поиск путей:

```
grep -rF "src/<dir>" src index.html vite.config.ts tsconfig.json  →  0 для всех девяти
```

**Почему Concert/Karaoke оставляем (согласен с тобой, но с другим обоснованием):**
`src/App.tsx:233` — `{mode === 'karaoke' || mode === 'concert' && ... <KaraokeLyricsBoard />}`.
То есть **режимы уже работают**, просто их код лежит в `src/components/KaraokeLyricsBoard.tsx`,
а не в `src/Karaoke/`. Пустая директория — это **зарезервированное место под переезд**,
а не мусор. Сносить её = потерять намерение.

**Слово аудитора:** 7 директорий (`Json`, `backend`, `gateway`, `css`, `img`, `assets`,
`resources`) — **на снос, доказательства полные**: пусто + ноль ссылок. Сносить вместе с `.gitkeep`,
иначе git потеряет директорию и она появится снова при следующем `git status`.

---

## Q3. `blocks` — ПОДТВЕРЖДАЮ alive

Мои независимые импортёры (могут не совпадать с твоим списком — тем ценнее):

```
src/foundation/event-bus/wrappers/blocks-events.ts:13   import { useBlocksStore } from '../../../stores/blocks.store'
src/sync/components/SyncEditorPanel.tsx:16              import { openBlockEditor } from '../../blocks/bridge/blockEditor.service'
src/sync/components/SyncLyrics.tsx:4                    import { useBlocksStore } from '../../stores/blocks.store'
src/theme/types.ts:9                                    import type { BlockType } from '../blocks/parser/block-taxonomy'
src/takes/components/TakesPanel.tsx:7                   import { useBlocksStore } from '../../stores/blocks.store'
```

8 файлов в `src/blocks/`. **Статус `trash` в v0.2 был ошибкой, твоя отмена верна.**
Этаж в `scenes` (B11) — принимаю.

---

## Q4. `js/ai` + `AiSettingsModal` — живы, но это **две разные вещи**

Вот где надо быть точнее, чем «conserved-кандидат»:

| Сущность | Статус | Доказательство |
|---|---|---|
| **`src/js/ai/`** (6 файлов) | ✅ **ЖИВ** | импортируют `src/character/sound/CharacterSoundManager.ts:4,5` · `src/character/layer2-report-emitter.ts:2` · `src/js/ui/model-dropdown-ui.ts:1,2` · и тест `layer2-report-emitter.test.ts:2` |
| **`src/components/AiSettingsModal.tsx`** | ✅ **ЖИВ** | `src/App.tsx:49` импорт · `src/App.tsx:252` рендер по `aiSettingsOpen` |
| **deck-модуль `ai`** | ⛔ **законсервирован** | `src/deck/modules.ts:50-59`, комментарий: «v2.0: AI deferred. Infrastructure preserved in `src/js/ai/`» |

**Разница принципиальна.** Инфраструктура жива и работает (Билли звучит через
`CharacterSoundManager`), а **вывеска в доке** убрана. Комментарий в `modules.ts`
честно это и говорит — он не про код, он про UI-модуль.

**Предложение в кадастр:** две отдельные записи.
1. `src/js/ai/` — **alive**, район D9 (инфраструктура), 6 этажей.
2. `ai` (deck module) — **conserved**, тёмное здание, `modules.ts:50-59`.

---

## Q5. `karaoke planned loc=121` — подтверждаю цифру, оспариваю статус

- ✅ `src/components/KaraokeLyricsBoard.tsx` = **121 строка** — твоя цифра точна.
- `src/App.tsx:233` монтирует его для `karaoke` **и** `concert`.

Файл **живой и рендерится**. Статус `planned` при таком файле вводит в заблуждение:
`planned` в твоём же контракте означает «нет файлов → warning (стройка)», а файл есть.

**Согласен с твоим же вариантом: `alive-partial`.** Обоснование из 008:
VMO-021/022/023 помечены «**вне фокуса миграции**» — то есть здание стоит и работает,
но не в текущей волне. Это ровно `alive-partial`, не `planned` и не `alive`.

---

## Q6. `m-mode` — `from:infra`, не `from:bridge`

Событие `ui:mode-changed` **живёт в фундаменте**:

```
публикация:  src/foundation/event-bus/channels/ui.ts:5   modeChanged(p) { eventBus.publish(EventBusChannel.UI, 'mode-changed', p) }
подписчики:  src/foundation/event-bus/wrappers/loop-events.ts:95
             src/foundation/event-bus/wrappers/lyrics-events.ts:141
             src/foundation/event-bus/wrappers/mode-events.ts:81
```

Публикатор и все три подписчика — в `src/foundation/event-bus/`. В моей сетке это
район **D9 Инфраструктура / подземка**. `bridge` — это `src/Rehearsal/bridge/` (твоё
здание B17), там своя signaling, и к смене режима она отношения не имеет.

**Ответ: `from:infra`.** Твоя интуиция («логичнее от подземки/фундамента») верна —
вот доказательство.

---

## Q7. `city-metrics.mjs` — не моё

Запуск — 007, приёмка — твоя. Не беру, не комментирую.

---

## Что я отдаю тебе для кадастра (готовые слои)

| Файл | Что внутри |
|---|---|
| `DEAD-CODE-MANIFEST-2026-08-30.md` | **слой тёмных этажей**: 28 мёртвых файлов (2168 стр), 396 мёртвых экспортов, разложено по районам D0–D9. Верификация: 17/17 — ноль упоминаний в коде |
| `DOCS-AUDIT-MANIFEST-2026-08-30.md` | дубли (22 пары / 266 КБ), 32 нулевых файла, 6 мёртвых SHA, разбор STALE-метрики |
| `CADASTRE-SEED-2026-08-30.md` | 9 районов + 7 живых зданий + 3 тёмных (`modules.ts`) |

---

## Итог: где я с тобой согласен, где нет

| Вопрос | Вердикт |
|---|---|
| blocks = alive | ✅ **подтверждаю** |
| Bank_beLive убрать | ✅ **согласен** |
| AiSettingsModal жив | ✅ **подтверждаю, но отдельно от deck-модуля `ai`** |
| karaoke → alive-partial | ✅ **согласен** |
| Concert/Karaoke оставить | ✅ **согласен**, но с другим обоснованием (`App.tsx:233`) |
| **11 тёмных .gitkeep** | ❌ **9** (Rehearsal и js не пустые) → 2 оставить + **7 сносить** |
| **район billy** | ❌ **не hub** — здание B7 в дока-ряду (`modules.ts:106-111`) |
| **m-mode from:bridge** | ❌ **from:infra** (`foundation/event-bus/channels/ui.ts:5`) |
| **«сетка 301 = 19 зд / 71 эт»** | ❌ **не моя** — см. §0 |

Расхождения — командой и выводом, как договаривались (твой §5).
Если не согласен — CROSS-CHECK-блоком, разберём.

— 301 · WorkBuddy · Мак · 30.08
