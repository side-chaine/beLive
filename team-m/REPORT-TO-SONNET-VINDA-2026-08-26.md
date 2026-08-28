# REPORT-TO-SONNET-VINDA — 2026-08-26
## Сводный отчёт для Соннет_Винда (Win-side Sonnet) · собрано 007_Мак (Far Light)
> Назначение: привести Win-side Соннета в курс ВСЕГО — статуса WIN-миграции v2→v3 (главная задача) и зафиксированных решений по Центрам/AI-ассистенту (отложенный post-m3 домен). Скомпоновано по `REGISTRY.md` (§7 Mac-side блоки 261–289) + `SYNC-MAC-TO-CENTER-2026-08-26a.md` (решения с Mac-side Соннетом) + `WAVE-EXEC-PLAYBOOK.md` / `WAVE-PREFLIP-BASELINE.md`.
> Контекст: два Соннета — Mac-side (вёл архитектуру Центров с Far Light) и Win-side (Вы). Этот документ — консолидированная выжимка для Вас.

---

## 0. Главное (TL;DR)
- **WIN-миграция v2→v3 (полное удаление Legacy + M3-GO flip) — execution-ready.** Hub (007_Винда) исполняет по `WAVE-EXEC-PLAYBOOK.md` одним GO → цепь 001→002→009. Frozen-guard 🟢 GREEN. Канон 306/767+5int+2load/PARITY.
- **Центры / Student-Педагог / AI-ассистент / bLb / pitch — ОТЛОЖЕНЫ post-m3** (директива Босса «всё кроме миграции V2-V3 — на потом»). Дизайн завершён и зафиксирован; применение — только ПОСЛЕ флипа + 5 волн.
- **Frozen-Zone read-only** для всех, кроме Hub во время волн: `AudioEngineV2.ts`, `patchV1.ts`, `track.orchestrator.ts`, `src/bridges/*`.

---

## 1. WIN-миграция — статус и план
**Цель:** перевести `engine-mode` в `'v3'`, отключить V2-бутстрап, вырезать все safe→frozen связи и удалить Legacy, НЕ трогая frozen-файлы.

**Flip-спека (1 коммит, frozen нетронут):**
- `src/engine-mode.ts:5`: `'v2'` → `'v3'` (позитивный критерий: `import.meta.env.VITE_ENGINE` в src/ ровно в 1 файле).
- `.env.example:23`: `VITE_ENGINE=v2` → `v3`.

**5 волн (leaves-first, по одной; между волнами — Frozen-guard GREEN + SHA256 frozen ДО/ПОСЛЕ идентичен):**
| Волна | Что | Живые счётчики (WAVE-PREFLIP-BASELINE) |
|---|---|---|
| W1 | activation cut (CUT branch) + **BAC-105** ре-поинт V2-глобалов | 12 reader-сайтов / **9 safe-файлов** |
| W2 | delegateSync + V2Adapter re-point | delegateSync **23** caller, V2Adapter **27** импортёров |
| W3 | stub-миграция (BAC-107: live-mode/waveformEditor stub + facade.ts:51) | — |
| W4 | orchestrator re-point + legacy/V2Adapter delete | track.orchestrator **7** импортёров; `src/legacy/engine-v3/*` = **9 файлов** (вкл. 2 test) |
| W5 | finalize (BAC-111 doc-debt + E1 cleanup, `__restoreV2Engine`→0) | — |

**Критерий волн = `grep → 0`** (не точное число). Расхождение V2Adapter: Mac grep 26 vs Hub baseline 27 — не блокирует.
**live-guard НЕ moved** (остаётся в `bridges/`, импорт `main.tsx:6` легитимен).

**Исполнение:** Hub ведёт через цепь 001→002→009 ПОСЛЕ одного GO Босса. Сейчас — дизайн/ревью/сканер (pre-GO).

---

## 2. Центры / AI-ассистент — зафиксированные решения (применять post-m3)
> Источник: `SYNC-MAC-TO-CENTER-2026-08-26a.md` (переписка Far Light ↔ Mac-side Соннет, §13/§14 + §6 + 2 усиления). Всё УТВЕРЖДЕНО; код частично уже слит.

**Уже в коде (реализовано Mac-стороной ранее):**
- §13.1 `ASSISTANT_RESPONSE_COMPLETED = 'assistant.response.completed'` (`src/js/ai/registry.ts:4`); единый dispatch в `aiHub.sendMessage.onDone` с `completionHandled`-гвардом.
- §13.4 `SoundCue = {kind:'synth'}&CueSpec | {kind:'asset',url,gain}` (`CharacterSoundManager.ts:15-17`); ветвление по `kind`, `playAsset` (decode+cache+антиклик), anti-click envelope в `blip` (attack 0.01, release exp).
- §13.5 mute (`ai-settings.store.ts` `soundEnabled` + `getSoundEnabled()`) + `COOLDOWN_MS=400` (защита от двойного фаера/долбёжки).
- §13.8 `AssistantProfile` Billy = первая запись реестра (`registry.ts:147-156`); `src/billy/*` runtime существует.
- §14 B/C/D/AEF — паттерн «один подписчик на звук» (CharacterSoundManager.init подписан 1×) + аватар = второй слушатель того же ивента.

**Утверждено, реализация post-m3 (НЕ frozen):**
- §13.2 `celebrateUntil` + `selectMood` (приоритет `listening` > `celebrateUntil` > `streaming` > `idle`) — добавить в `src/avatar/avatar.store.ts`.
- §13.3 `activeAssistantId` отдельно от `activeModel` (рядом с `coachName` в `ai-settings.store`); `getActiveModel()` НЕ зависит от персонажа (уже так).
- §13.4 мост: `AssistantProfile.soundProfile?: CueSpec` → `SoundCue`; **Billy → `{kind:'asset', url:'/audio/assistants/r2d2.mp3', gain: подобрать на слух}`** (усиление №1: Billy играет СВОЙ ассет, не синт-блип); `CUE_DEFAULT` — дефолт для персонажей БЕЗ ассета; `gain` ассета НЕ наследует 0.15.
- §13.5 `reducedMotion` — отдельный флаг (НЕ связан с mute); семантика (§6.3): **гасит ТОЛЬКО анимацию/движение, не состояние**.
- §13.6 `FallbackAvatar` минимальный pop на `celebrateUntil` (700мс, scale 1.06, `@media reduced-motion` → `animation:none; opacity:1`); один источник правды с `data-state="happy"`.

**Усиления Соннета (ПРИНЯТЫ):**
1. Billy = `asset` (r2d2.mp3), не synth.
2. **S3-bypass ГЕЙТ:** при применении `MICRO-PACK-S3-VIDEO-IMPL.patch` ЯВНО проверить, что его `sendMessage`-вызовы идут через `registry.ts`/`aiHub`, а НЕ заводят собственный fetch/stream в обход (как когда-то legacy `ai-chat-ui.ts`).

**§13.7 YouTube — ВНЕ M1:** нужен отдельный research-пас по плееру/embed/URL-parsing. Ждём бриф.

---

## 3. Что нужно от Соннет_Винда (Win-side)
1. **YouTube-слой** (§13.7) — research-пас; в репозитории кода нет.
2. **425 + G4 + M3-GO** — архитектурная спека Центра (реестр §2 BLOCKED: «архитектурная спека Центра/006, вне зоны 007»). Нужна Ваша/Центра спецификация порога флипа.
3. **MIC-УШИ-СЕССИЯ** — бриф 006 (solo/vocal-fade/auto-pause/RTL).
4. Подтвердить/уточнить спеки §13.2/§13.6 (FallbackAvatar pop, reducedMotion) — если есть отклонения от зафиксированного.
5. Учесть S3-bypass гейт при интеграции Student-Педагог (патч готов, НЕ применять до флипа).

---

## 4. Границы и SSOT
- **REGISTRY.md = SSOT** (Hub-owned, volatile). Правки решений → туда + перенос в `06-OPEN-DECISIONS.md` (beLive-Context).
- **Frozen-Zone read-only** для всех кроме Hub во время волн. CharacterSoundManager уже standalone WebAudio (мимо Frozen) — держать.
- **Sequencing:** Центры/Student-Педагог/bLb/pitch — ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ M3-GO флипа + 5 волн Hub-а. Дизайн параллелится сейчас свободно.
- **Интеграция S3 ↔ Центры:** `MICRO-PACK-S3-VIDEO-IMPL.patch` (Student-Педагог video/chat) дёргает `aiHub.sendMessage`; `onDone` шлёт `ASSISTANT_RESPONSE_COMPLETED` → звук (готов) + (будущий) аватар-муд. Интерфейс состыкован из коробки.

---

## 5. Готовые артефакты (для справки)
- `team-m/WAVE-EXEC-PLAYBOOK.md` — исполнение flip + 5 волн.
- `team-m/WAVE-PREFLIP-BASELINE.md` — живые счётчики.
- `team-m/SYNC-MAC-TO-CENTER-2026-08-26a.md` — полные решения §13/§14 + §6.
- `team-m/MICRO-PACK-S3-VIDEO-IMPL.patch` — S3 MVP-1 (ОТЛОЖЕН).
- `team-m/INITIATIVE-FOCUS-MAIN-TASK.md` — фокус на миграции.
- `team-m/bLb/frozen-guard.mjs` + `frozen-guard-baseline-2026-08-26.md` — 🟢 GREEN.

— 007_Мак (Far Light). Готово к переносу / релейу Mac-side Соннетом → Соннет_Винда.
