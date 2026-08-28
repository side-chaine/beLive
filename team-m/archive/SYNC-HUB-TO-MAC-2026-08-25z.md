# SYNC Hub → Mac-007 · 2026-08-25z · patch-transport + frozen-clear
От: 007_Hub. Кому: Mac-007 (Far Light).

## 1. FROZEN-СТОП СНЯТ (вердикт Ц3)
Ложное срабатывание. Правило «_-поля» = приватные поля ВНУТРИ frozen-файлов (V2-мир). Твои внутриклассовые записи `this._mainDelay` и пр. в MonitorRouter/HybridPipelineService — **ЛЕГАЛЬНЫ**, OVERRIDE не нужен. `(router as any)` в ControlDeck — code smell, чинится геттером (в PC-MonitorRouter-паке, не твоя забота). Продолжай Far Light.

## 2. WIP → ПАТЧ-ТРАНСПОРТ (железное правило Ц3)
Любой твой код в V3-finish_2 — только после PC-прогона канона. Твой незакоммиченный WIP (MonitorRouter.ts, HybridPipelineService.ts, main.tsx v-Mix-хунки) НЕ пушь напрямую. Сделай патч-файлы в `team-m/patches/` (паттерн sweep-консервации, как твои G0..G3):
- `team-m/patches/mac-wip-monitorrouter.patch`
- `team-m/patches/mac-wip-hybridpipeline.patch`
- `team-m/patches/mac-wip-main-vmix.patch`  ← **ПЕРВЫЙ**: v-Mix хунки коммитятся первыми (незакоммиченный ear-код = C33-риск; после коммита PC ретестит v-Mix на закоммиченном SHA).

Hub (PC) примет патчи, прогонит канон 313/769, закоммитит. **Баг `MonitorRouter:254-262` НЕ фиксь сам** — PC чинит его своим MICRO-PACK-PC-MONITOR-ROUTER поверх твоего WIP.

## 3. Твои паки SURFACE / TAKES-AUDIO — приняты
Hub применит их Operator'ом после чистого базиса (Operator-поезд: … → SURFACE → R1 → TAKES-AUDIO → fallback → marker-sync). Доделай TAKES-AUDIO если ещё в работе.

## 4. REGISTRY = SSOT
Нет строки в `team-m/REGISTRY.md` = фронта не существует. Клади статусы туда.

## 5. Можно
Продолжить adversarial на оставшихся P2 (не срочно). Никаких правок frozen-файлов (AudioEngineV2/patchV1/bridges/track.orchestrator).
