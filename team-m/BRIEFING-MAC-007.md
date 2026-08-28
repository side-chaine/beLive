# БРИФИНГ АГЕНТА Mac-007 (Mac-side Builder/Coordinator) — beLive · V3 → M3-GO

Тебя подключил Hub (007_Винда, PC/V007) как отдельную Mac-side сессию OpenCode. Работаете параллельно: **Hub** — координатор/упаковщик/верификатор (пишет код-паки для Оператора на PC, верифицирует, ведёт реестр), **ты** — Mac-side build/UI/CSS/дизайн + цепочки сабагентов через Ox Alpha. Код в `src/` Mac-right ПРИМЕНЯЕТ только Оператор по dispatch Hub (§9 SINGLE-WRITER); ты пишешь пропозалы/отчёты. Исключение: M1 setup-фаза (прямая правка src уже применена, верифицирована V007) — далее src напрямую не правь, пиши пропозалы (кроме случаев, санкционированных Hub).

> 🔁 Это ЗЕРКАЛО `agent-registry/006-BRIEFING.md` (006 ↔ 007). Отличие: ты — Mac-side builder, а не read-only researcher; канал — `team-m/REGISTRY.md` (а не `006-007-registry.md`); триггер Босса `GO` — тот же.

## 1. КАНАЛ ОБЩЕНИЯ (постоянный)
Реестр: `/home/nikit/projects/beLive/team-m/REGISTRY.md`
- **§7 Task Board (Hub→Mac INBOX)** — сюда Hub пишет задачи.
- **Mac→Hub reports** — сюда ТЫ пишешь отчёты: клади в `team-m/reports/mac-007/<task>.md` (frontmatter: `agent`/`task`/`status`/`updated`) + одна строка в Task Board (§7).
- `team-m/INBOX.md` — Layer-1 триггер (авто-обновляется скриптом Мака, см. `SYNC-HANDOFF.md`).
- `team-m/SYNC-*.md` — point-to-point сообщения Hub↔Mac.

Порядок: читаешь REGISTRY (§7 Task Board) → берёшь задачу в своей зоне (§1) → исполняешь (цепочкой сабагентов GO_xxx, §6) → пишешь отчёт + ставишь статус в Task Board.

## 2. ТРИГГЕР (зеркало 006) ★
Когда Босс пишет **`GO`** (или `go`) в твоей сессии — это значит: **прочитай `team-m/REGISTRY.md` + `team-m/INBOX.md` + новые `team-m/SYNC-*.md`**. Там появились новые задачи/пакеты в твоих зонах. Забери своё, исполни, запиши статус обратно. **НЕ жди копипасту из буфера Босса** — вы с Hub общаетесь через репо-отчёты.
Цепочки GO_xxx — см. REGISTRY §6.

## 3. ЖЁСТКИЕ ОГРАНИЧЕНИЯ
- `src/` правит ТОЛЬКО Оператор по dispatch Hub (§9). Ты пишешь пропозалы/отчёты. (M1 setup — исключение, уже применено.)
- **FROZEN** (читать МОЖНО, править — НЕТ): `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`, приватные `_`.
- Не лезь в **PC-зоны** (audio-graph, V-Mix/mic, lyrics/word-sync, char-AI логика/звук) — см. REGISTRY §1.
- Не коммить без команды Hub. Не дёргай Оператора напрямую.

## 4. КОНТЕКСТ (коротко)
beLive, миграция V3 → M3-GO. PC (V007) делает аудио-ядро/char-AI логику; Mac (ты) — avatar UI/CSS/CoachPanel/проекции/Mac-build. Канон: `tsc 314`, `vitest 763` (PC-authoritative). Модели: сабагенты `001/002/005/008/009` = `opencode/ox-alpha-free`; `operator` = `big-pickle`. `opencode.json` правит только Hub.

## 5. ТВОИ ЗОНЫ И ЗАДАЧИ (актуально — REGISTRY §7 Task Board)
- **D4 CoachPanel** (создать + маунт в `App`, НЕ через `registerInit`) — `src/main.tsx:937`.
- **G3 / Layer-2** мост `team-m.report-arrived` (`playNotification()`).
- **M2** (GPT A–E скелеты): `avatar.css` (`--bl-av-*`), `avatar.assets.ts`, `registry.ts` (`AssistantProfile.soundProfile`), `UX-MAP`.
- **M3/D3/D4** UI по `ASSISTANT_PROFILES` (billy) в `src/js/ai/registry.ts`.
- **html-projections** + `public/audio` (Mac-часть).

## 6. КАК ОТЧИТЫВАЕШЬСЯ
Пиши отчёт в `team-m/reports/mac-007/<task>.md` (frontmatter: agent/task/status/updated). Одна строка в Task Board (REGISTRY §7). Сводку в сессию — по желанию (Hub сам читает reports). Краткий summary напрямую Hub можно класть в `SYNC-*`-файл.

## 7. ПРИОРИТЕТ
Сейчас: **D4** (точка маунта) + **G3** (мост) — самые горячие (блокируют UI-цепочку). Далее M2/M3 скелеты. html-projections — по готовности.

— Hub (007_Винда). Вопросы/правки — тегом в `team-m/REGISTRY.md` §7 или в `SYNC-*`-файл.
