# SYNC-MAC-TO-HUB — 2026-08-26m
## Тема: Вёдра, всё подготовлено максимально — исполняй по плейбуку (ONE GO)

Босс дал GO на применение всех правок самим Вёдрой; моя задача — подготовить тебя по максимуму. Готово.

### Что внутри
- **`team-m/WAVE-EXEC-PLAYBOOK.md`** — ЕДИНЫЙ лист исполнения: пре-флайт → M3-GO flip (2 правки) → 5 волн по одной (safe-файлы, frozen-зона read-only, grep-гейты, SHA256-инвентарь) → финальный гейт → rollback. Копипастишь команды волна за волной.
- **`MICRO-PACK-WAVE1..5.md`** — перепроверены на stale-числа; WAVE1/индекс уточнены (9 safe-файлов / 12 reader-сайтов, live с `WAVE-PREFLIP-BASELINE.md`).
- **`WAVE-PREFLIP-BASELINE.md`** — авторитетные живые счётчики (delegateSync 23, V2Adapter 27, globals 9/12, track.orchestrator 7).
- **`WAVE-FROZEN-INVARIANTS.md` + `bLb/frozen-guard.mjs`** — 🟢 GREEN baseline; гоняй перед каждой волной.

### Ключевые правила исполнения
1. **Frozen-зона read-only**: `AudioEngineV2.ts`, `patchV1.ts`, `track.orchestrator.ts`, `src/bridges/*`. Трогать только SHA256-инвентарём (до/после — должны совпасть байт-в-байт).
2. **Критерий волн = `grep → 0`**, не точное число (расхождение V2Adapter 26/27 не блокирует).
3. **live-guard НЕ moved** (W4) — остаётся в `bridges/`, импорт `main.tsx:6` легитимен.
4. **Flip**: `engine-mode.ts:5` `'v2'`→`'v3'` + `.env.example:23` `VITE_ENGINE=v2`→`v3`. 1 коммит, frozen нетронут.
5. **bLb / S3 / pitch — ОТЛОЖЕНЫ** (post-m3), НЕ в плейбуке. Патч S3 готов (`MICRO-PACK-S3-VIDEO-IMPL.patch`) — НЕ применять до флипа.

### Что от тебя
Один GO → читаешь `WAVE-EXEC-PLAYBOOK.md` → исполняешь flip + 5 волн → гоняешь цепь 001→002→009 (auto-гейты) → РЕШЕНО. Мак на проверке/дизайне, в код не лезу.

### Статус
- Frozen-guard: 🟢 GREEN (baseline).
- Канон для сверки ДО старта: **306 / 772 / PARITY PASS**.
- Расхождение для сверки: V2Adapter Mac-grep 26 vs baseline 27 (критерий grep→0).

Жду твой старт.
— 007_Мак (Far Light, read-only/design)
