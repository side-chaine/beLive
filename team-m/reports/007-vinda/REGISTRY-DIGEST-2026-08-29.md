# REGISTRY-DIGEST · 2026-08-29 (для выравнивания карты Hy4)

> Роль: explore (scout). Только факты из репо. Frozen-файлы не трогал — читал для факта: REGISTRY.md, PARITY-LEDGER.md, INBOX.md, docs/modernization/05-INITIATIVES-LEDGER.md, reports/007-vinda/VIS2-PITCH-RECON-2026-08-29.md, reports/007-vinda/VIS34-FACTS-2026-08-29.md.

## БАЗА: HEAD a691c2f · REGISTRY (325 строк) · дата 29.08

Канон-снапшот: tsc=296, vitest=761+0int+0load, PARITY=PASS; HEAD a691c2f; V3 = дефолт и В ПРОДЕ (app.mybelive.com, тег v2-final-production на cdfb2eb — снапшот V2 для YouTube-демо).

---

## 1. Миграция W1-W6 + прод (статусы с источником-строкой)

| Волна | Статус | Источник (файл:строка) | Цитата (≤15 слов) |
|---|---|---|---|
| W1 | ПРИМЕНЕНА+ЗАКОММИЧЕНА `521cb82f` | BRIEFING-ROADMAP-2026-08-26.md:13 / REGISTRY:43 | "W1 `521cb82f`; cut V2 activation BAC-105" |
| W2 | ПРИМЕНЕНА `ba184c5`+`d0e31af` | BRIEFING-ROADMAP-2026-08-26.md:13 / REGISTRY:43 | "W2a/b `ba184c5`+`d0e31af`; delegateSync/V2Adapter re-point" |
| W3 | ПРИМЕНЕНА+ЗАКОММИЧЕНА `02e3ac9` | REGISTRY:33 | "W3 ПРИМЕНЁН + ЗАКОММИЧЕН (28.08, commit `02e3ac9`)" |
| W4 | ПРИМЕНЕНА+ЗАКОММИЧЕНА `2766ddc` | REGISTRY:37 | "W4 ПРИМЕНЁН + ЗАКОММИЧЕН (28.08, commit `2766ddc`)" |
| W5 | ПРИМЕНЕНА+ЗАКОММИЧЕНА `18cb248` | REGISTRY:39 | "W5 ПРИМЕНЁН + ЗАКОММИЧЕН (28.08, commit `18cb248`)" |
| W6 | ПРИМЕНЕНА+ЗАКОММИЧЕНА `8f0b3ad` | REGISTRY:41 | "W6 ПРИМЕНЁН + ЗАКОММИЧЕН (28.08, commit `8f0b3ad`)" |

**Смоуки Босса (подтверждено ушами/консолью Босса):**
- W3-SMOKE ПРОЙДЕН (REGISTRY:34; PARITY-LEDGER.md:19-21): "красный мастер-фейдер управляет music-bus ✅ … стем other грузится+рулится где есть".
- W4-SMOKE ПРОЙДЕН (REGISTRY:38; PARITY-LEDGER.md:23-26): "6 стемов + auto-play ✅, Space pause/resume ✅, Shift+Arrow смена трека ✅".
- W5-SMOKE ПРОЙДЕН + ФИНИШ-GO (REGISTRY:40; PARITY-LEDGER.md:28-31): "модалка Block Editor ОТКРЫВАЕТСЯ через новый openBlockEditor() ✅".

**ФИНИШ миграции (REGISTRY:43):** "🏁 МИГРАЦИЯ V2→V3 ФИНИШИРОВАНА (28.08): волны W1-W5 + W6 hygiene-фронт применены и закоммичены; V3 = дефолт".

**Выкачка в прод (REGISTRY:45):** "🚀 V3 ВЫКАЧЕН В ПРОД (28.08) … тег `v2-final-production` на `cdfb2eb` … fast-forward merge в main (`cdfb2eb..780db23`) … Деплой верифицирован … CF Pages `app.mybelive.com` + GH Pages `side-chaine.github.io/beLive`. V3 = прод."

**Что подтверждено ушами Босса vs «ждёт браузер-тест»:**
- Подтверждено ушами: W3/W4/W5-SMOKE (фейдеры, music-bus, 6 стемов, auto-play, seek, track-switch, Block Editor вход). Канон tsc=296/vitest=761+0load/PARITY PASS.
- «Ждёт браузер-тест» (в очереди bLb, НЕ блокирует): GUARD-36 markers-out-of-bounds; CORS feed-bot; остаток mic-уши-сессии; внутренности Block Editor (решение Босса: в bLb).

---

## 2. Микшер/стемы/Inst (факты)

- **BAC-002 (Fader Order / «Other»):** REGISTRY:8 — "СТАТУС: НАБЛЮДЕНИЕ + VERIFY — проверить момент загрузки Fader Order". Не «5/6 нестабилен», а одноразовая аномалия загрузки одного стема (retry/backoff защита ПРИМЕНЁНА, НЕ доказывает решение).
- **Красный Inst-фейдер = мастер-группа music-стемов, РАБОТАЕТ:** W3-SMOKE (REGISTRY:34) "красный мастер-фейдер управляет music-bus ✅". Механизм подтверждён кодом: ControlDeck.tsx:199/220 пишет `setBusVolume('music-bus', v)`; `busOf()` HybridPipelineService.ts:635-641 маршрутизирует 'other'→'music-bus'; VIS34-FACTS:58-73. BusFader18 §9 retain (REGISTRY:33).
- **«From the Inside» — нет other в stemsData, НЕ баг:** REGISTRY:34 / PARITY-LEDGER.md:20 — "«From the Inside» не имеет other в stemsData (импортный ZIP, не баг … вероятно импорт до BAC-002-фикса `04ed754`; переимпорт решит)". Легально по данным трека (VIS34-FACTS:5.7).

---

## 3. Баг-лист 008 → статусы по реестру

Баг-лист 008 (REGISTRY:212, скрины владельца 22-26.08): FOUC лирики / нестабильный фейдер Other / лирика под TrackMap / питч НЕ подключён к V3 / луп-линия / GetSongBPM Back / редактор блоков.

| Баг | Реестр | Статус |
|---|---|---|
| FOUC лирики | BAC-001 — REGISTRY:7,12 (ЗАКОММИЧЕН `184a3a3`, 009 verdict РЕШЕНО) | ЗАКРЫТ |
| Other/фейдеры (Fader Order) | BAC-002 — REGISTRY:8 (НАБЛЮДЕНИЕ+VERIFY) | ОТКРЫТ (наблюдение) |
| лирика под TrackMap | BAC-003 — REGISTRY:9,12 (ПАК `04ed754`) | ЗАКРЫТ |
| GetSongBPM Back | BAC-004 — REGISTRY:10,12 (ПАК `04ed754`) | ЗАКРЫТ |
| луп-линия | BAC-005 — REGISTRY:11,12 (ПАК `04ed754`, объединён с BAC-003) | ЗАКРЫТ |
| питч→V3 | REGISTRY:212,310 («питч НЕ подключён/сломан на V3») + VIS2-отчёт (оба канала мертвы) | ОТКРЫТ (нужен ARC-2 вход) |
| редактор блоков | W5 — REGISTRY:39,40 (вход мигрирован, открывается ✅; внутренности = эпоха bLb) | ВХОД ОК / ВНУТРЕННОСТИ ОТКРЫТЫ (bLb) |

ЗАКРЫТЫ фактами: BAC-001, BAC-003, BAC-004, BAC-005 (+ V2-TEST-CLEANUP убрал 5 intentional fails: REGISTRY:42). Ещё ОТКРЫТЫ: BAC-002 (наблюдение/verify), питч (VIS-2), внутренности редактора блоков (bLb).

---

## 4. Питч (белое пятно или факт)

Реестр НЕ молчит, но поверхностен — глубина причины = белое пятно, закрытое свежим отчётом:
- REGISTRY:212 (скрины владельца): "питч НЕ подключен к V3 + детекция ~80% с ложными октавами".
- REGISTRY:310 (Mac Update #2): "pitch-connect: ОТЛОЖЕНО (post-m3) — питч и так сломан на V3, не блокер флипа; OPT-IN только если Босс явно".
- REGISTRY:268 — Mac отчёт `pitch-scope-chain.md` (до флипа): "ПОДКЛЮЧЕНИЕ РЕШЕНО/КАЧЕСТВО ОТЛОЖЕНО". Это design-verdict ДО миграции; после флипа фактически мёртв.

**Свежий факт (VIS2-PITCH-RECON-2026-08-29.md, HEAD a691c2f):** питч к V3 НЕ подключён; в V3-режиме мертвы ОБА канала (мик + вокал-трек), т.к. pitch-engine читает V2-глобали `window.audioEngine.{audioContext|vocalsGain|stems}`, которых у V3-фасада нет; `pitch.store.ts:45,49` зовёт несуществующие `PitchEngine.get()`/`engine.init()`. Прямой вход в ARC-2 миграции: переключить источники на `MicSourceV3`/`getStemAnalyser('vocals')`/`getAudioContext()`.

**Вердикт:** реестр подтверждает «питч сломан на V3» высокоуровнево; точный механизм (оба канала мертвы, несуществующие get()/init(), ARC-2 scope) = белое пятно в реестре, заполнено VIS2-отчётом 29.08.

---

## 5. Город bLb (что есть)

Все факты — REGISTRY:316-325 (Mac Update #3, 28.08) + REGISTRY:35 (city-коммиты):
- **bLb-CITY-v0.2-quiet.html** (`780db23`+патчи): тихий город GLM, честная камера flyTo, шёпот кварталов, гейт-контроль сноса, exportCadastre()/journal() API.
- **houses.yaml v0.2** (`a3a6426`): ЕДИНЫЙ кадастр — 19 зданий + подземка + внешние; what/gives/rooms; реальные loc/files замерены 28.08 (Live=126, Academy=10665, Studio=21199 строк); Karaoke/Concert = планируемые здания.
- **Метро = EventBus v2**: 28 событий (`src/foundation/event-bus/types.ts`), 14 линий, формат канал:событие. D14 дрейф: doc `eventbus-v2.md` заявляет 29, в коде 28 (REGISTRY:321).
- **city-gen.mjs v2**: парсер секций + валидация контракта (exit 1 при нарушении) + инъекция CITY/TOUR в HTML. Прогнан: 0 ошибок, 19 зданий, 7 кварталов, 14 линий, тур 9 остановок.
- **tour.yaml** — YouTube-тур как данные (9 остановок + CTA); **CITY-PROTOCOL-2026-08-28.md** — контракт слоёв/записи/гейтов; **city-journal.yaml** — аудит пульта.
- **city-metrics.mjs — ЗАДАЧА ПК** (REGISTRY:324): досчитать loc/files/t30 по git → city-metrics.json, затем пересобрать город; оба read-only к src/.
- **Известные дыры маппинга** (REGISTRY:325): темы/пресеты (нет события в шине), питч (legacy main.js вне шины), 5 зданий без линий (styles/karaoke/concert/profile/aiconfig) — предупреждения city-gen, не ошибки.

**Статус пилота BLB-5:** INITIATIVES-LEDGER.md:104 — "⏳ ЖДЁТ GO". Миграция завершена 28.08, город v0.2 готов, но GO на пилот ещё не дан (ждёт итогов брифинга 007+007_2).
**Что сказал Босс:** BLB-2 (INITIATIVES-LEDGER.md:101) — "От простого к сложному. Смотрим восприятие и синхронизацию. Развиваем по запросу" (bLb-light, не полный город сразу).

---

## 6. Инициативы Hy4 vs реестр (таблица)

Источник инициатив: docs/modernization/05-INITIATIVES-LEDGER.md (Кай/Hy4, 29.08, база от 07-14 + скрины 22-26.08). Факты реестра — REGISTRY.md / VIS2/VIS34-отчёты.

| Инициатива Hy4 (INITIATIVES) | Факт реестра | Статус по реестру |
|---|---|---|
| SEC-1 MVSEP-ключ удалён везде | REGISTRY:214,327 — DEPLOY.md→`${MVSEP_API_KEY}` коммит `1dfb7b1`, grep=0 | ЗАКРЫТО (подтверждено) |
| SEC-2 TG-токен отозвать | REGISTRY:327 — код вычищен (`requireEnv`), но токен `AAHWkRIA…` в публичной истории → отзыв @BotFather OPEN | КОД ЧИСТ / ОТЗЫВ ОТКРЫТ |
| SEC-3 Last.fm ключ перевыпустить | REGISTRY:327 — значение бейкнуто в dist/ (GitHub Pages), переиздать+redeploy | OPEN |
| SEC-4 GetSongBPM ключ перевыпустить | REGISTRY:327 — значение бейкнуто в dist/, переиздать+redeploy | OPEN |
| SEC-5 гейт check-secrets.mjs | REGISTRY:327 — гейт перенесён в репо + CI-пакет | ЗАКРЫТО (подтверждено) |
| TG-токены вычищены из дерева + пуш | REGISTRY:327 — "Дерево очищено … ЗАПУШЕНО (`78b19f4..7d165d1`, main)" | ЗАКРЫТО (подтверждено) |
| ARC-2 миграция v2→v3 (шаг ①) | REGISTRY:43,45 — W1-W6 применены, V3=прод, канон 296/761 | ЗАКРЫТО (Hy4 пишет «В РАБОТЕ» — УСТАРЕЛО) |
| BLB-5 пилот города | REGISTRY:316-325 + INITIATIVES:104 | ЖДЁТ GO (город v0.2 готов) |
| ARC-6 02-PROGRAM-ROADMAP снято | REGISTRY:43 + INITIATIVES:92 — построен на базе 07-14, W1-W6 применены | СНЯТО (корректно) |

Ключевое расхождение Hy4: ARC-2 помечен «🔄 В РАБОТЕ», но реестр фиксирует ФИНИШ + прод (REGISTRY:43,45). Hy4-канон «tsc=211» (INITIATIVES:163) vs факт 296/761 (REGISTRY:43).

---

## 7. УСТАРЕВШЕЕ В КАРТЕ Hy4 (топ-список для коррекции)

Hy4 строил карту по базе 2026-07-14 + скриншотам 22-26.08. Главные точки, где карта устарела (с фактом-источником):

1. **Миграция V2→V3 «в работе»** — факт: ФИНИШ 28.08, все W1-W6 применены, V3 в проде (REGISTRY:43,45). Hy4 ARC-2 должен стать ЗАКРЫТО.
2. **Inst-фейдер «сломан/мост»** — факт: с W3-SMOKE красный мастер-фейдер = music-bus, РАБОТАЕТ (REGISTRY:34; VIS34-FACTS ControlDeck.tsx:199/220).
3. **«SPLIT = мост»** — Босс сказал НЕ мост; в V3 микшер = виртуальные шины gain (HybridPipelineService busOf :635-641), не физический мост. (Коррекция по слову Босса; см. INITIATIVES BLB-9:108 «STUDIO/SPLIT раскиданы».)
4. **«Other» = баг микшера** — факт: одноразовая аномалия загрузки, НАБЛЮДЕНИЕ+VERIFY (REGISTRY:8); «From the Inside» — other отсутствует в данных, легально (REGISTRY:34).
5. **Питч «подключён/работает ~80%»** — факт: НЕ подключён к V3, оба канала мертвы, нужен ARC-2 вход (REGISTRY:212,310; VIS2-отчёт).
6. **FOUC лирики «виден на скрине»** — факт: ЗАКРЫТ BAC-001 (`184a3a3`), 009 РЕШЕНО (REGISTRY:7,12).
7. **Легаси «ещё не удалено»** — факт: `src/legacy/engine-v3` снесён в W4 (`2766ddc`); V2Adapter DEFER (4 импортёра); FROZEN нетронут (REGISTRY:43).
8. **«Канон tsc≈211/212»** (INITIATIVES:163) — факт: tsc=296 / vitest=761+0int+0load (REGISTRY:43).
9. **Город bLb «не существует/черновик»** — факт: v0.2, 19 зданий, city-gen.mjs v2, метро EventBus 28 событий, tour.yaml (REGISTRY:316-325).
10. **V2-TEST-CLEANUP «5 intentional fails в каноне»** — факт: убраны в W2-cleanup, vitest 761+0int+0load (REGISTRY:42).

---

### Миниатюра
W4: применён+закоммичен `2766ddc`, W4-SMOKE ПРОЙДЕН ушами Босса (REGISTRY:38) — «6 стемов+auto-play ✅». BAC-002: НАБЛЮДЕНИЕ+VERIFY (REGISTRY:8). Питч: в реестре НЕ тишина («питч … сломан на V3», REGISTRY:310), но точный механизм — белое пятно; свежий факт VIS2-отчёт: оба канала мертвы, pitch.store зовёт несуществующие get()/init().
