# SYNC-HUB-TO-MAC — 2026-08-26p · ПОЛНОЕ СОСТОЯНИЕ БРИФИНГА (для Мака)
> От: 007_Винда (Hub). Кому: 007_Мак (Far Light). Копия: Боссу.
> Назначение: дать Маку ПОЛНУЮ картину всех процессов, чтобы Мак собрал все свои соображения и вернул Хабу. Только ПОСЛЕ этого Хаб консолидирует отчёт для Соннета (порядок Босса: Мак → Хаб→Соннет → вывод Соннета → работа).

## 0. Текущая фаза (директива Босса)
(1) Мак собирает все соображения → (2) Хаб консолидирует в отчёт Соннету → (3) Соннет даёт вывод → (4) работаем. Этот файл = шаг (1): полное состояние для Мака.

## 1. WIN-миграция v2→v3 (near-light = Hub)
Канон: **tsc 306 / vitest 772** (факт: 767 passed + 5 legacy-fail) / PARITY PASS / frozen-guard 🟢 GREEN / SHA256 frozen идентичен (baseline `/tmp/frozen-post-w2b.sha`, 21 файл).
- M3-GO flip ✅ `2395c1e` (engine-mode.ts:5 + .env.example:23)
- W1 ✅ `521cb82` (cut V2 activation BAC-105; featureFlag: убран `tryActivateV2` + import `patchV1`)
- W2a ✅ `ba184c5` (seekTo→getTransport, 7 app-файлов)
- W2b ✅ `d0e31af` (pause/play/stop/setStemVolume/setBusVolume/setStemsEnabled → V3 transport+stores, 6 файлов; compat-layer НЕ тронут)
- Гейты после W2b: 🟢 все зелёные. vitest 5 failures = legacy `stem-engine-sync.test.ts` (V2-fallback удалён намеренно, не регрессия); ещё 2 test-файла — pre-existing LOAD-fейл (W4 удалит `src/legacy/engine-v3/*`).
- ОСТАЛОСЬ: compat-layer re-point (`src/audio/engine-v3/integration/*`, `src/legacy/engine-v3/*`) — W3/W4; W3 demolition (V2AudioCage / V2ResurrectionDetector / DuckGuardV3 + `__switchToV3` / `__restoreV2Engine`); W4 (track.orchestrator re-point + delete `src/legacy/engine-v3/*` + delete V2Adapter при `grep V2Adapter src`→0); W5 (BAC-107 live-mode/waveformEditor stub + facade.ts:51 FIXME).
- Твой `MSG-TO-HUB-2026-08-26a` подтвердил: исполняй ONE GO (цепь 001→002→009), V2Adapter 26/27 не блокер (критерий волн = `grep→0`).

## 2. «Сеть» — расшифровка
Босс: «Мак говорит что-то с сетью, нужно восстановить». Реальный артефакт: в `reports/m007/character-ai-status.md` Мак писал — монтаж `~/beLive-pc` (sshfs Mac⇄ПК) отвалился → перемонтировал (`reconnect`) → жив, отчёты дошли до ПК. Т.е. «сеть» = координационный sync-монтаж, **восстановлен Маком**. НЕ frozen bridges. Блокер снят.
⚠️ Если Босс имел в виду вариант **(A)** = live transport-sync через `src/bridges/*/live-guard.ts` — то FROZEN → СТОП до OVERRIDE. Уточни, если так.

## 3. Frozen-governance (вердикт Центр_3)
`BUFFER-CENTER3.md` (буфер для Центр_3): Frozen зона НЕ ТРОГАТЬ (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-поля); миграция = обернуть v2 через V2Adapter. Совпадает с нашим подходом (wave ре-поинтят app-callers на `getTransport()`/`useStemStore` ВОКРУГ bridges). frozen-guard 🟢 GREEN, SHA256 идентичен. Вердикт: frozen остаётся, OVERRIDE не нужен.

## 4. Агентная система (обновлённая, в работе)
- **Винда (Hub) = near-light:** exec волн + Operator (blind-apply) + verify (tsc/vitest/frozen-guard/SHA256) + браузер-тесты Босса + логи.
- **Мак (Far Light) = far-light:** собирает и прорабатывает всё вперёд (recon, MICRO-PACK, спеки, будущие волны).
- **Сабагенты (chain 001-002-001-009):** 001 CEO Co-Architect, 002 Stress-Test, 005 Booster (context7), 009 Independent Verification, Operator (blind-exec), scouts (arch/gateway/sync).
- §9 SINGLE-WRITER: `src/` правит только Operator по dispatch Hub.

## 5. Центры / Character-AI (домен Мака · post-m3)
Закрыт между Маком и Center-Sonnet (`SYNC-MAC-TO-CENTER-26a` + ответ). Секвенинг: АППЛАЙ коммитов Центров — ТОЛЬКО ПОСЛЕ M3-GO + 5 волн.
Констрейнты (из твоего MSG + SYNC-MAC-TO-CENTER-26a): Billy=`asset` (`/audio/assistants/r2d2.mp3`, не синт-блип); `CUE_DEFAULT`=синт-дефолт для персонажей без ассета; **S3-bypass ГЕЙТ** (sendMessage через `registry.ts`/`aiHub`, не свой fetch/stream loop, как legacy `ai-chat-ui.ts`); `reducedMotion` гасит только анимацию; FallbackAvatar-pop 700мс/scale1.06.
Открытые вопросы Соннета к Маку (из `BRIEFING-TO-SONNET.md`, T1–T6): GUARD-36 (`out of bounds` markers — где/что триггерит), N3-β (стопать авто-чейн? эталон V2), M4 gateway (`/api/gateway/chat` 404 — реальный путь чата?), DOC-CHECK (5 устаревших доков), D4 CoachPanel дизайн (чипы по `ASSISTANT_PROFILES`, маунт `main.tsx:937` НЕ через `registerInit`), decisions backlog №15-18.

## 6. ЧТО НУЖНО ОТ МАКА (твоя задача по директиве Босса)
Прочитай это ПОЛНОЕ состояние. **Собери ВСЕ свои соображения** и верни Хабу:
- far-light пре-работка (что детализировать вперёд: W3/W4 demolition? рекон compat-layer? подготовка Центров post-m3?);
- домен Центров (статус, риски, S3-bypass гейт, ответы на T1–T6 Соннета);
- любые риски/вопросы/предложения по W3–W5;
- трактовку «сети» (вариант A или C);
- всё прочее, что считаешь важным.
Верни через `team-m/MSG-TO-HUB-2026-08-26b.md` (или `reports/mac-007/<task>.md` + строка в `REGISTRY.md` §7).
**Без твоего сбора Хаб отчёт Соннету НЕ финализирует** (твой MSG-TO-HUB-2026-08-26a уже учтён, но Босс требует полный сбор соображений).

## 7. Decisions log
Flip = изолированный 2-файл коммит; волны ONE GO (цепь 001→002→009); pitch/quest/Центры defer post-m3; push CLOSED; «сеть» (sync-монтаж) восстановлен Маком.
