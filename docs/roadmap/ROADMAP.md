# beLive · Дорожная карта · ЕДИНЫЙ ГРАФ

> **Источник истины — `docs/roadmap/roadmap-data.json`.** Этот файл **генерируется**, руками не правится.
> GitHub рендерит Mermaid нативно в Markdown — без сборки и зависимостей.
> Граф виден владельцу, 707 и CEO в одном месте, рядом с кодом.
<!-- HEAD:START -->
> **Снимок:** 10.11.2026 22:29 · `origin/main = 0000000`
> **Дрейф:** 9c7c37b → f0717e1 (#54/#55) → 0464dd5 (#56) → fd9a113 (#57/#58) → ca45f643 (#59) → 6cd4f1f (#60–#69: living-graph #60, frozen-ab #61, n1c2 #62, frozen-guard v2/v3/upsert #63–#68, npm ci #69) → cfb5383 (#70: roadmap v2.2) → c27dd6e (#71: W0 MVSEP) → 2c89fdc (#72: A2.1) → c479336 (#73: A2.2 Порт + Пульт)
<!-- HEAD:END -->

<!-- GRAPH:START -->
```mermaid
%% Единый граф · beLive · сплошная — жёсткая зависимость, пунктир — «связано»
flowchart LR
  subgraph Dtrunk["Магистраль N0–N8"]
    direction TB
    N0["N0 · Аудит Центр_5<br/>NODES / ROADMAP / PDF<br/>100%"]:::done
    N1["N1 · Гейты<br/>8 гейтов в CI · FROZEN v3 required<br/>100%"]:::done
    N1c_2["N1c.2 · Линт-долг<br/>1155 → 695 · пакет смержен #62<br/>100%"]:::done
    N2["N2 · P0-баги рантайма<br/>2.1–2.5 · очередь<br/>0%"]:::queued
    N3["N3 · Шум консоли<br/>805/N3 готов к воротам<br/>35%"]:::active
    N4["N4 · Размер бандла<br/>очередь<br/>0%"]:::queued
    N5["N5 · Мусор репозитория<br/>очередь<br/>0%"]:::queued
    N6["N6 · Похороны V2<br/>очередь<br/>0%"]:::queued
    N7["N7 · Шов JS ↔ React<br/>самый тяжёлый<br/>0%"]:::risk
    N8["N8 · История git<br/>окно заморозки<br/>0%"]:::queued
    dec_n3f3["dec-n3f3 · N3 Ф3 · типы персиста<br/>0%"]:::waiting
  end

  subgraph Dtrackmap["TrackMap + система Лупа"]
    direction TB
    line_trackmap["line-trackmap · TrackMap + система Лупа<br/>PR #50 · 21 файл · tsc 0 · в проде<br/>100%"]:::done
  end

  subgraph Dfirstpath["First Path / MVSEP"]
    direction TB
    dec_mvsep["dec-mvsep · Отзыв старого ключа MVSEP<br/>0%"]:::waiting
    line_firstpath["line-firstpath · First Path / MVSEP<br/>PR #55 · Gate R PASS · в проде<br/>100%"]:::done
  end

  subgraph Duserroom["User Room"]
    direction TB
    line_userroom["line-userroom · User Room<br/>PR #56 · в проде<br/>100%"]:::done
  end

  subgraph Dmobile["Mobile performance"]
    direction TB
    dec_702["dec-702 · 702 · FROZEN A+B / F5<br/>0%"]:::waiting
    line_mobile["line-mobile · Mobile performance<br/>PR #51 · в проде<br/>100%"]:::done
  end

  subgraph Dseo["SEO-витрина"]
    direction TB
    dec_cfpages["dec-cfpages · CF Pages belive-seo<br/>0%"]:::waiting
    line_seo["line-seo · SEO-витрина<br/>PR #52 #58 · в проде<br/>90%"]:::waiting
  end

  subgraph Daicoach["AI Coach"]
    direction TB
    dec_prompts["dec-prompts · 20 промптов от 706<br/>0%"]:::waiting
    line_aicoach["line-aicoach · AI Coach<br/>PR #54 · рев.4 проверена (tsc 0, 23 теста)<br/>90%"]:::waiting
  end

  subgraph Dfrozen["FROZEN-guard"]
    direction TB
    line_frozen["line-frozen · FROZEN-guard<br/>PR #59 #63 #66 #68 · 60/60 · required<br/>100%"]:::done
  end

  N0 --> N1
  N1 --> N1c_2
  N1c_2 --> N2
  N3 --> N4
  N4 --> N5
  N2 --> N5
  N5 --> N6
  dec_702 --> N2
  dec_prompts --> line_aicoach
  dec_cfpages --> line_seo
  dec_n3f3 -.- N3
  dec_mvsep -.- line_firstpath
  dec_702 -.- line_mobile
  line_seo -.- line_aicoach
  line_mobile -.- N2
  line_frozen -.- N1

  classDef done fill:#123c2a,stroke:#39d98a,color:#eafff3;
  classDef active fill:#4a3410,stroke:#ffc44d,color:#fff6de;
  classDef blocked fill:#4a1c1c,stroke:#ff6b6b,color:#ffe9e9;
  classDef waiting fill:#33204d,stroke:#a371f7,color:#f3ecff;
  classDef queued fill:#1b2430,stroke:#7f93ad,color:#c9d6e5;
  classDef risk fill:#4a1c1c,stroke:#ff6b6b,color:#ffe9e9,stroke-dasharray:5 4;
```
<!-- GRAPH:END -->

## Как читать

- Магистраль `N0 → … → N8` — **модернизация** по `board/NODE-IDS.md`. Линт-долг = **N1c.2**, а не N2.
- Продуктовые линии идут **параллельно** и уже в проде; фундамент не отстаёт от фич.
- `dec-*` — решения Никиты. Без них узел не двигается; их не решают ни CEO, ни 707.
- **ПРОД-готовность** = магистраль до N6 включительно + пустой список `dec-*`.
- **Осознанная граница, не долг:** FROZEN ~298 варнингов и `js/monitor-mix.js` 115. Центр_5 зафиксировал: «это не недоделка».
- **N7 / N8** — только после явного GO, отдельно. Шов JS↔React по объёму равен всем остальным узлам вместе, но не блокирует прод.

## Дрейф main за 09–10.11 (почему замеры переснимают)

`9c7c37b` → `f0717e1` (#54/#55) → `0464dd5` (#56) → `fd9a113` (#57/#58) → `ca45f643` (#59) → `6cd4f1f` (#60–#69: living-graph #60, frozen-ab #61, n1c2-null-curly #62, frozen-guard v2/v3/upsert #63–#68, npm ci --ignore-scripts #69) → **`c479336`** (#70–#73: roadmap v2.2 #70, W0 MVSEP #71, A2.1 очередь в данных #72, A2.2 Порт + Пульт #73).

Правило №6: pregate только на текущем `origin/main`. Устаревшая база = FAIL.

## Конвейер «всегда актуально»

```
roadmap-data.json             ← ЕДИНСТВЕННЫЙ источник (правит командующий)
        │                       до мержа пакета: мост board/
        │                       после мержа:      репо docs/roadmap/
        ├─ generate-roadmap.mjs --write
        │     ├─→ ROADMAP.md          (Mermaid для GitHub)
        │     ├─→ ROADMAP-GRAPH.html (интерактивный пульт, без CDN)
        │     └─→ MIRROR_DIR         (вторая площадка, без ручного копирования)
        │
        └─ generate-roadmap.mjs --check   (CI, КАЖДЫЙ PR)
              ├─ exit 1 STALE      — забыли --write
              ├─ exit 3 INVALID    — опечатка в статусе / дубль id / битая схема
              └─ exit 0 in sync
```

🔴 **Почему Action НЕ коммитит в `main`:** ветка защищена (Require PR + статус-чеки). Автокоммит обошёл бы защиту. Поэтому CI **проверяет** актуальность, а обновляет граф командующий локально и сдаёт пакетом в 007_c.

## Ответы на три блокирующих вопроса (второй разбор DeepSeek)

**№1 · Триггер.** Workflow идёт на **все PR** (`on: pull_request` без `paths`), плюс push в `main`. Гейт на ~1 секунду (zero-dep, без `npm install`), так что «тратит минуты» неверно. `paths`-фильтр убран: PR со сменой статуса, не тронувший `docs/roadmap/`, теперь **не проходит молча**.

**№2 · Что сверяет `--check`.** Только **сгенерированные артефакты ↔ закоммиченные артефакты**. Поле `main` в JSON — **информационный снимок**, оно **не сравнивается с HEAD**: `main` двигается на каждом мерже, и такая проверка была бы вечно красной (ровно тот design-баг, о котором предупреждал DeepSeek). В CI передаётся `EXPECTED_MAIN` — он даёт **неблокирующий `⚠`** о возрасте снимка, а не fail.

**№3 · Мост ↔ репо.** Признаю: две копии = новый дрейф. Решение:
- **Канон после мержа = `docs/roadmap/roadmap-data.json` в репозитории.** Он виден и WorkBuddy (через `/mnt/c/...` или WSL-клон), и CEO в harness, и человеку на GitHub.
- Мостовая копия объявляется **зеркалом**, в неё пишет `MIRROR_DIR` при `--write`; `--check` проверяет обе площадки. Ручное копирование исчезает. Рев.2 (10.11): перед записью сверяется подпись шаблона v2 — старый v1-шаблон в зеркале это громкий `exit 3` до касания файлов, а не тихо сломанная страница.
- Переход: пока пакет не влит, канон временно в мосту; 007_c кладёт файлы в репо → с этого момента правится только репо-клон. Зафиксировано в MANIFEST.

**№4 · HTML без CDN (рев.2).** В HTML **нет Mermaid-рендера вообще**. Это свой SVG-рендерер: кластеры направлений, рёбра только из `edges[]`, панорама/зум, инспектор и заметки владельца в localStorage — читает встроенный `DATA` схемы v2. Ни библиотек на 2–3 МБ, ни сборки. Значит «live» честно означает: **живой дашборд из одного JSON**, а не «живой Mermaid». GitHub показывает Mermaid из `ROADMAP.md` (статично), пульт даёт клики/детали (интерактивно). Разные представления — один источник.

**№5 · Валидация (рев.2, схема v2).** `schema: belive.roadmap.v2`, enum `state ∈ {done, active, blocked, waiting, queued, risk}`, `progress 0..100`, уникальность `id`, рёбра ссылаются только на существующие узлы, обязательные поля. Опечатка в состоянии теперь падает **громко** (`✗ INVALID DATA`, `exit 3`), а не молча рисует серый узел.

**№6 · Дисциплина.** Записана в `rules/PLAYBOOK.md` → **Definition of Done**: любой PR, меняющий статус/метрику/состав, обязан включать перегенерированный roadmap. Без `--write` + `--check` пакет не готов.

## Протокол синхронизации

1. Перед обновлением: `git ls-remote origin main`; SHA в `roadmap-data.json` — снимок, не гейт.
2. **Один владелец:** JSON правит **только командующий** (707 / CEO). Агенты присылают отчёты файлом.
3. **Триггер:** влился PR · сменился статус узла · изменились гейты · появилось/снялось решение Никиты.
4. **DoD:** `BOARD.md` (летопись) → JSON → `--write` → `--check` → пре-gate → 007_c. Генерируемые блоки руками не правим.
5. **Расхождение в цифрах** закрывается разбивкой по зонам, не спором. В данные попадает только проверенное.
6. Возврат состояния CEO_Orch через 5 часов сверяется с этими данными; разошлись — правится сначала источник.

## Инструменты (проверено 09.11, в т.ч. независимой проверкой DeepSeek)

| Решение | Вердикт |
|---|---|
| **Mermaid** | ✅ слой отображения для GitHub. Нативный рендер, diagram-as-code, приватно |
| **`roadmap-data.json` + генератор** | ✅ источник истины. Заменяет «живой» инструмент без внешних зависимостей |
| **ROADMAP-GRAPH.html** | ✅ локальный интерактивный пульт: статусы, клики, блокеры. Без Node и CDN |
| **Plangy** (`npm 0.6.12`) | ⚠️ реален, «plan.md → live-reload в браузере». Держать в резерве, если захотим готовый live-reload |
| **GitDiagram** | ⚠️ другой класс: архитектура кода, не roadmap. Совместим как второй слой (отдаёт Mermaid) |
| **D2 / LikeC4 / Structurizr / Roadmapper** | ⚠️ реальны, но требуют бинаря/CI/DSL и не рендерятся в GitHub нативно |
| **Nodit / planpilot** | ❌ **не существуют** (npm 404, GitHub 0 репо) — в ответе DeepSeek были галлюцинации. Не внедрять |

Ссылки и разбор — `board/GRAPH-RESEARCH-VERDICT.md`.

## Поддержка

- Данные: `board/BOARD.md`, `board/NODE-IDS.md`, `board/REGISTRY.md`, `opencode-import/centr-5/NODES.md`.
- Если скопировать `ROADMAP.md` в репозиторий, GitHub отрендерит граф сам.
- Обновляет файл — командующий (707 / CEO) после каждой смены `origin/main`.
