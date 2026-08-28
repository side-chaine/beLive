# Sync Handoff (Mac → Windows)

- Мак пишет отчёты в `team-m/reports/<agent>/<task>.md` (фронтматтер: agent/task/status/updated).
- После каждого отчёта запускается `mac-state.sh` → обновляет `team-m/INBOX.md`.
- V-сторона (ПК, V007) читает `team-m/INBOX.md` по sshfs-монтажу и видит готовые решения Мака.
- НЕ трогать root `REPO-STATE.md` (его ведёт ПК-хук) — триггер живёт в `team-m/INBOX.md`.
- ❄️ Frozen Zone: `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`, приватные поля `_`. Мак пишет ТОЛЬКО пропозалы/отчёты (не правит `src/` напрямую — код применяет Оператор по dispatch V007).
- Брифинг для M007: `team-m/BRIEFING-V007-TO-M007.md`.
