# ROSTER-WAVE1-draft · паспорта волны-1 · 004 «Реестр-Пульс» · 2026-09-09 23:3x · DRAFT

**Основание:** HANDOFF-004 §ПЕРВЫЕ 3 ЗАДАЧИ №2 · CONSTELLATION-В-v2 §B/§C (волна-1 = 2 живых + пилот-скрипт + 3 L2-семьи, Саннет Q6) · PULSE-RUN-CONSTITUTION:130.
**Состав волны-1 (канон):** MO-dock (живой, К1-инцидент) · MO-mode-switch (живой, Н-1 dual-transport) · пилот loop = СКРИПТ-CI без LLM · 3 L2-семьи (loop, track-loader, v3-interceptor) — поле family в MAP, НЕ агенты.

## FROM_REPOSITORY-ПРОВЕРКА (всей волны, 23:3x)
- `ls team-m/HANDOFFS/` — пусто (хендофов MO-* нет) · `ls .opencode/agent/ | grep -iE '^mo|dock|mode'` — пусто (промптов MO-* нет).
- `grep -rn "MO-dock|MO-mode-switch|MO-loop|MO-track-loader|MO-v3-interceptor"` вне спек-документов — только PULSE-RUN-CONSTITUTION.md:130 (дизайн-канон волны, не агент).
- **Вердикт: двойников НЕТ — все пять сущностей новые.** EXISTING-коллизий: 0.

---

## ПАСПОРТ 1 · MO-dock (живой L1-кандидат, семья deck-surface)

**FINGERPRINT:** `mechanism:deck.store · class:deck-surface` (ядро) + стыки `mechanism:ControlDeck · class:push-dock` (main) / `mechanism:DeckBar · class:dock-bar` (SB)
**СЛОЙ:** ядро MAP-строки (deck.store, deck/registry, deck/modules) — пишу я (MO-dock); стыки/компоненты (ControlDeck.tsx, DeckBar.tsx, TransportPanel.tsx, ui-флаги) — зона B01-HUB.
**СЫРЬЁ v0:** heartbeat = ручное 00 Никиты (фаза-2 — CI-коммиттер); вход = NERVOUS-LOG дельты + TRIGGERS-строки.

**Семья deck-surface (факты, file:line, оба трека):**
| объект | main | SB (feature/yt-prep) | источник |
|---|---|---|---|
| ядро-стор | `src/stores/deck.store.ts` persist `bl-deck` :31-34 (expanded+activeTabId) | тот же (:31-34 идентичны) | grep обоих HEAD |
| push-док | `src/components/ControlDeck.tsx` (581 строк, `--bl-deck-height` :82/:98, expanded :27) | ControlDeck.tsx жив + **DeckBar.tsx + DeckBar.css** (реформа Z1/Z2) | ls-tree SB |
| транспорт | `src/components/TransportBar.tsx` | **TransportPanel.tsx + .css** (SB-only) | ls-tree SB |
| реестр модулей | `src/deck/registry.ts` + `modules.ts` + `types.ts` (3 файла) | те же | glob УЗ-4 класс deck=3 |
| seed-досье | — | **SCENARIOS-DOCK-A-FINAL-2026-09-09.md (мост zones/reform/, 24 клетки + 9🔴 + 7 XS)** | ls моста |

**Границы (CONSTELLATION §C):** loop=MO-loop · sync=B08/MO-sync-word · show=B03/MO-show. TransportPanel — владение по kind (AM-8): ДВ/z-инвариант = dock; transport-семантика = transport-семья волны-2.
**⚠️ РАСХОЖДЕНИЕ СПЕК §C (доклад CEO_1):** «ui.store-kind:deck-флаги» — grep `deck` по `src/stores/ui.store.ts` на ОБЕИХ ветках = 0 совпадений (main и SB: только catalog/feed/karaoke-поля). Флаги дока живут в deck.store (expanded/activeTabId/visualMode :27-30). Спека, вероятно, имела в виду SB-эру C4-кодификации — проверка при рождении агента.
**Инцидент-основание (К1):** отравленный CSS-комментарий DeckBar.css:5 (Z1-эра, SB) — класс «правило молча дропнуто CSSOM»; R2-замер 006 закрыл. Живой именованный инцидент = основание L1 (конституция:130).

---

## ПАСПОРТ 2 · MO-mode-switch (живой L1-кандидат, свой механизм)

**FINGERPRINT:** `mechanism:mode-switch.service · class:dual-transport`
**СЛОЙ:** ядро = `src/services/mode-switch.service.ts` (пишу я); стык App.tsx:232-233 (рендер-развилка) — зона B01-HUB.
**СЫРЬЁ v0:** heartbeat = ручное 00; вход = synapse-warn (волна-2) + дельты NERVOUS-LOG.

**Факты (file:line):**
- `mode-switch.service.ts:30-33` — `emitModeChanged` = `window.dispatchEvent(CustomEvent('mode-changed'))` — **транспорт №1** (document-CustomEvent).
- `App.tsx:232-233` — `{syncOpen && <SyncLyrics/>}` И `{(mode==='karaoke'||'concert') && <KaraokeLyricsBoard/>}` — **два центра лирики** (S11-подклетка, Д-1 прогона А): sync-замещение НЕ гейтит karaoke-центр.
- `src/foundation/event-bus/wrappers/mode-events.ts` — event-bus-обёртка (транспорт №2, политика стем-громкостей MODE_STEM_POLICIES) — жива, импортируется main.tsx.
- Подписчики mode-changed: 8 файлов (loop-events, lyrics-events, mode-events, channels/ui, billy.constants, ai-tools и др. — grep 23:3x).
**Инцидент-основание (Н-1, мина У5):** dual-transport mode-changed без единого наблюдателя = тихий убийца; 6 гейтов не ловят (CONSTELLATION §B). Возвращён в волну-1 решением 002/009.

---

## ПАСПОРТ 3 · Пилот loop = СКРИПТ-CI (L2-семья, БЕЗ агента)

**FINGERPRINT:** `mechanism:loop.store · class:drift-subscriber` (пилот-скрипт, не LLM)
**СЛОЙ:** ядро loop.store — скриптовые CI-проверки (дрейф/near-miss/синтетика — PULSE-NERVOUS-v2 §5); промоушн в живого агента — при первом СВОЁМ инциденте через 301 (конституция:130).
**СЫРЬЁ v0:** CI-окна (verify:ci на пуше main, deploy.yml:33); ручные [SB]-прогоны логируются в NERVOUS-LOG (условие-4 009).
**Факты:** synapses = `loop-set/loop-cleared/loopcompleted` (types.ts:46-48, grep 23:2x); near-miss-инвариант isLooping⇔loopSubBlockKeys≠∅ (recalculate :39-60, спека §5); K-B (угон авто-пасса repeat'ом) = находка превенции, не живое событие.

## ПАСПОРТ 4 · L2-семья track-loader (поле family, не агент)

**FINGERPRINT:** `mechanism:track.loader · class:role-stem-mismatch`
**СЛОЙ:** ядро — L2-семья в MAP (family: track-loader); наблюдение = гейты + месячная 009-приёмка.
**⚠️ ВАЖНО:** track.loader ВНЕ скелета MAP (нет .service-суффикса — расхождение №1, доложено CEO_1 23:27). Факты: role≠stemId :266/:306/:533 (`role: stemDef?.role ?? 'music'` — мёртвый фидер 'music', K-B/Z2-цепь). При расширении охвата — первая строка-кандидат.

## ПАСПОРТ 5 · L2-семья v3-interceptor (поле family, не агент)

**FINGERPRINT:** `mechanism:V3DataInterceptor · class:dual-transport-loader`
**СЛОЙ:** ядро `src/audio/engine-v3/integration/V3DataInterceptor.ts` (в скелете, класс 3) — L2-семья.
**Факты:** Н-1 два транспорта track-loaded: `document.dispatchEvent` :242 (+ :252/:256 stem-ready/fully-loaded) И `AudioBus.trackLoaded()` (досье 201: :224); Н-3 FOUC-порядок :200 vs :224 (индикатор гаснет раньше рассылки). 10 ступеней загрузки — здание «ЗАГРУЗКА» (эскиз 201).

---

## Зона-links (предложение разметки волны-1, коммит② §8)
- deck-surface → **B01-HUB** (ControlDeck в paths зоны) · mode-switch → **ORPHAN** (сервис без зоны; стык App.tsx = B01-HUB) · loop → **ORPHAN** (сирота, спека §5) · track-loader → **B09** (каталог-стык) · v3-interceptor → **B01-mixer** (engine-v3/pipeline в paths зоны).
- Все ссылки — предложения; финальная разметка = MAP-строки после маркера «Z2-применена+cron».

— 004 · 09.09 23:3x · ростер волны-1: 2 живых паспорта + пилот-скрипт + 3 L2-семьи; from_repository 0 двойников; 2 расхождения спек честно помечены 🫀
