# СВОДКА ДЛЯ SONNET — фронты beLive (Hub→Sonnet), 26.08 (актуализировано после Центр_3)

## 0. TL;DR для Sonnet
beLive готов к финальному срезу Легаси (V2→V3). Hub (007 Винда) уже исполнил M3-GO flip + W1 + W2 (canon 306 / 767 passed + 5 intentional legacy-fail + 2 load-fail pre-existing; frozen 🟢; SHA идентичен). Волны W3/W4/W5 **полностью препарированы** (chain 001→002→001→009, doc-reconciled, РЕШЕНО) и ждут только твоей санкции + closure-таблицы от Мака. Центр_3 провёл аудит — подтвердил последовательность W3→W4→W5 без реордера, снял блокер «Сеть» (вариант B = sshfs, живой), поставил retro-тег pre-M3, выдал директивы (closure-таблица + G-трек → Маку; BAC-108 до E7; M3-VERIFY в W4).

## 1. Что уже сделано (не требует Соннета)
- M3-GO flip `2395c1e7`: `engine-mode.ts:5` + `.env.example:23` → v3 (БЕЗ `App.tsx:88` — легитимный рефактор, зафиксировано в PLAN §8).
- W1 `521cb82f`: App.tsx V2-activation cut + featureFlag `tryActivateV2`/`patchV1` удалены.
- W2a `ba184c5` + W2b `d0e31af`: 13 файлов re-point на V3 transport/stores; V2-fallback удалён. tsc=306, frozen 🟢, SHA256 21 файл идентичен (`/tmp/frozen-post-w2b.sha`).
- Retro-тег `pre-M3` на `2395c1e7` (Ц3 усиление #2). Worktree `/tmp/opencode/pre-M3-check` проверен (checkout OK; tsc env-blocked — нужен node_modules; boot нужен браузер Босса CDP V1–V10).

## 2. Волны W3/W4/W5 — СТАТУС: РЕШЕНО (prep, ждут GO)
| Волна | Пак | Суть | Frozen-блок |
|---|---|---|---|
| 3 | `MICRO-PACK-WAVE3.md` | `__switchToV3`/ae-guard/`V2AudioCage`/`V2ResurrectionDetector`/restore→crash-modal + `DuckGuardV3` DELETE; BusFader18 §9 retain; терминологическая дисциплина Ц3 4.1a | — |
| 4 | `MICRO-PACK-WAVE4.md` | `track.loader.ts` NEW (loadTrack+globals) + re-point 3 importers; DELETE `legacy/engine-v3/*` (9); V2Adapter DEFER (grep≠0); M3-VERIFY gate | track.orchestrator/patchV1/AudioEngineV2/bridges |
| 5 | `MICRO-PACK-WAVE5.md` | BAC-107 (stub+facade+FIXME) + `blockEditor.service` patchWaveformEditor removal; `__restoreV2Engine` delete; BAC-109/110 (hygiene/doc) | комментарии-V2 retain |

Все три: канон 306/767+5int+2load + PARITY + boot-smoke CDP V1/V5 + SHA256 + ⛔-отчёт + Frozen-guard 🟢.

## 3. Директивы Центр_3 (аудит 26.08) — что учтено в препе
- **W3→W4→W5 подтверждён без реордера** (Hub-фронт #1: да, исходный порядок FINAL-ROADMAP §2).
- **Closure-таблица 18 строк** (что закрыто где/коммит | что открыто→какая волна) — МАКУ; W3 не возобновлять без неё (Ц3 4.2.2).
- **G-трек (Gate 3B) приоритет #1 Мака**: финализировать 425 spec; G0-draft для подписи №4 готов к W4. Drift-риск #2 (финальная цель) — вне волн срезки.
- **BAC-108** (gateway `localhost:8787`) = prod-blocker, закрыть ДО E7, ВНЕ волн (GO-checklist line).
- **M3-VERIFY** добавлен в гейт W4 (dist-grep + positive-controls `getStemMeterLevel`/`loopcompleted`/`audioglitch` ПЕРВЫМИ + step-0 инвентарь дист-дерева).
- **mic-уши-сессия** — между W3 и W4 (Ц3 4.1 timing).
- «Сеть» = вариант B (sshfs Mac⇄PC, живой) — блокер СНЯТ (вариант A = frozen-stop, не применим).
- Параллелизм агентов: scouts параллельно, 001/002/005/008/009/Operator СТРОГО последовательно (зафиксировано в `AGENT-EXEC-MODEL.md` + `SHARED.md`).

## 4. Что нужно от Sonnet (твой фронт)
1. **Подтвердить фронт-определение** (если ещё не): W3→W4→W5 без реордера (Ц3 уже подтвердил — можешь просто сказать GO).
2. **«Сеть»** — Ц3 дал ответ: вариант B (sshfs), блокер снят; вариант A (frozen-stop) НЕ применим. Можешь зафиксировать.
3. **Операционная модель** — цепочка 001→002→001→009 + near/far подтверждена Ц3 (rails: PC-canon для merge / ⛔-гейты на волны / REGISTRY=SSOT). Никаких новых моделей.
4. **Новые вводные от Ц3 для твоего вывода:** closure-таблица Мака обязательна перед W3; G-трек реактивировать (Мак); BAC-108 до E7; mic-сессия между W3/W4.
5. **Вывод Соннета**: когда скажешь «GO на волны» — Hub исполнит W3→W4→W5 по пакам (после получения closure-таблицы от Мака). Никакой реордер.

## 5. Канон и замки
- tsc=306 / vitest 767 passed + 5 intentional legacy-fail (V2-fallback removed W2b) + 2 load-fail pre-existing (legacy/engine-v3, W4 delete). PARITY = сравнение наблюдаемого поведения V3-path.
- Frozen-guard 🟢 GREEN. SHA256 21 файл идентичен pre/post-W2b.
- Branch `backup/win-V3-finish_2-2026-08-23`; push CLOSED.

## 6. КОМУ ЧТО
- **Мак (Far 007_Мак):** closure-таблица 18 строк + G-трек (425/G0-draft #4) — релейнуто в `SYNC-HUB-TO-MAC-2026-08-26q.md`.
- **Sonnet (ты):** фронт-определение + GO (этот файл).
- **Hub (007 Винда):** исполнение волн по GO; prep готов.
- **Босс:** браузер для П-12 boot (CDP V1–V10) + финальный GO на push.

## 7. Статус ретро-тегов
- pre-M3 `2395c1e7` ✅ поставлен (П-12 full: worktree→build→boot→discard — boot нужен браузер Босса).
- pre-M5 = repo-rollback (позже).

## 8. Дополнение Центр_3 (аудит) — кратко
А-1 G-трек стоял (drift) → Маку приоритет #1. А-2 flip 2 файла (не 3) — легитимно, записано. А-3 канон 306/767+5int+2load — зафиксировано. А-4 PARITY метод после flip определён (поведение V3-path). А-5 BAC-108 prod-blocker до E7. А-6 «Сеть»=B, блокер снят. Front-directive 4.1 (W3→W4→W5 + M3-VERIFY/W3-дисциплина), 4.2 (G-трек+closure-таблица Маку), 4.3 (сеть=B), 4.4 (модель), 4.5 (BAC-108 вне волн; BAC-109/110=W5). Reinforcements: retro-тег ✅; G-трек+closure-таблица Маку; PLAN §1/§8 обновлён; mic-сессия между W3/W4; frozen-guard в pre-GO; PARITY метод.
