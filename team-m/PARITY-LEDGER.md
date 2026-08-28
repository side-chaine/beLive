# PARITY-LEDGER · beLive (записи расхождений/подтверждений аудио-путей)

> Источник правды для сверки «что слышим vs что в коде». Ведёт Hub (007_Винда). Запись обязательна при любом ушном подтверждении/дрейфе (норма с 385-го отчёта Центра_3).

## V-Mix / TASK-015 — музыка в центре
- **Факт (ушная валидация Босса, 2026-08-25):** при активации V-Mix — mic → RIGHT, вокальная дорожка трека → LEFT, музыка → centre.
- **Атрибуция:** DECIDED (user-validated). Не дрейф: базис `docs/architecture/n-stem-architecture.md` FR-008 — «V-Mix stereo separation is a monitor comfort transform, NOT program truth; Program Capture reads from buses, not VocalMix merger». Centre-pan музыки = дефолт монитор-шины.
- **Решение:** TASK-015 закрыт ушами юзера. Запись в леджер — обязательна (по требованию Центра_3).
- **Связь с каноном:** позвоночник v3 DONE; канон tsc 313 / vitest 769.

## C27 · solo/mute-инвариант — уши
- **Факт (ушная валидация Босса, зафиксирована в SYNC-HUB-TO-MAC-2026-08-26k.md:18):** solo/mute инвариант подтверждён ушами в M3-GO-сессии. effectiveGain применяется на stretchGain (V3-путь).
- **Атрибуция:** DECIDED (user-validated, pre-W3). Запись создана 28.08 ретроактивно (closure-таблица строка 2, норма Ц3-385).

## C28 · индикация обоих режимов — уши
- **Факт (ушная валидация Босса, зафиксирована в SYNC-HUB-TO-MAC-2026-08-26k.md:19 + console `[AETHER] ✅`):** индикация V2/V3-режимов подтверждена ушами в M3-GO-сессии.
- **Атрибуция:** DECIDED (user-validated, pre-W3). Запись создана 28.08 ретроактивно (closure-таблица строка 3, норма Ц3-385).

## W3-SMOKE · 28.08 · фейдеры/music-bus/other (post-v3active-restore `3623882`)
- **Факт (уши Босса, 28.08, dev `npm run dev` = V3 по дефолту):** красный мастер-фейдер слышно управляет минусом (music-bus); пер-стем фейдеры отзываются по отдельности; `__v3Active` = false на буте → true после auto-play (по дизайну); стем `other` грузится и рулится на треках, где есть в данных (Breaking the Habit: 6 стемов, RouteCheck 6 routes). «From the Inside» имеет только 4 music-стема в IDB (other отсутствует в stemsData — импортный ZIP, не баг кода; вероятно импорт до BAC-002-фикса `04ed754`).
- **Атрибуция:** DECIDED (user-validated). Регрессия W2b (мёртвый writer `__v3Active`, коммит `d0e31af`) закрыта фиксом `3623882` (цепь 001→002→009, MICRO-PACK-V3ACTIVE-RESTORE).

## W4-SMOKE · 28.08 · track.loader/queueTrackJump/seek/track-switch (post-W4 `2766ddc`)
- **Факт (уши+консоль Босса, 28.08, dev `npm run dev` = V3):** трек грузится через новый `track.loader.ts` (OrchTiming-логи из нового файла); `typeof window.queueTrackJump === 'function'` ✅; 6 стемов загружены (vocals/bass/drums/other/guitar/keys, RouteCheck 6 routes) ✅; auto-play V3 ✅; Space = pause/resume (resume с 26.98s) ✅; **Shift+Arrow = смена трека** ✅; **Arrow = seek** (RECON-SEEK gen=1..10) ✅; M2 latency load-to-first-audio 1.1–1.4s.
- **Атрибуция:** DECIDED (user-validated). W4 = SAFE-перенос frozen-оркестратора (byte-identical копия) — регрессий нет.
- **Наблюдения (НЕ W4-регрессии, в очереди):** (1) `lyrics-events.ts:71 [GUARD] CRITICAL: N markers out of bounds. Data migration needed` при каждой загрузке трека (52/55 маркеров) — pre-existing проблема контракта маркеров (тег GUARD-36), отдельное расследование; (2) CORS `belive-feed-bot.nikitosss007.workers.dev/tracks` для localhost:3000 — CORS воркера захардкожен на `https://app.mybelive.com`, внешний фикс (CF worker); (3) FR-007 stem pan not supported — известное предупреждение; (4) `main.tsx:229/270/281` log-wording «V2 continues» — кандидат W5-hygiene.

## (место для последующих записей: mic-уши сессия, №17/№18 ретесты, RTL, auto-pause…)
