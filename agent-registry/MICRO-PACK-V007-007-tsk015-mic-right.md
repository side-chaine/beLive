# MICRO-PACK V007-007 — TASK-015 fix: mic only RIGHT in V-Mix

**Автор:** 007 (coordinator) · **Исполнитель:** Operator (blind)
**Статус:** READY · **Frozen:** НЕ ТРОГАТЬ (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-private поля)
**Канон:** `tsc --noEmit` ровно **314** · `vitest run` **763/763**

---

## 🐞 Баг (подтверждён в консоли)
При V-Mix ON мик слышен в ОБОИХ ушах, хотя V-Mix-мастер шлёт мик строго в RIGHT (`MonitorRouter.ts:145` `vmixMicIn → merger ch1`).
Причина: самоконтроль мика (monitor-шина) идёт моно в оба уха:
`micInput → _micDelay → _monitorGain → _monitorMaster → ctx.destination`.
Лог: `setVMix(true)` + `ControlDeck [MON-PROBE] monitorGain=1` (🎤 ON) → мик дублируется поверх V-Mix-R.
Результат: мик = right (V-Mix) + оба уха (монитор) = в обоих ушах.

## 🎯 Желаемое (от юзера)
При активации V-Mix мик-сигнал должен быть **только справа**.

## 🔧 Правка (1 файл, 1 метод, +1 строка)

### ФАЙЛ: `src/audio/engine-v3/monitor/MonitorRouter.ts`

**Метод `setVMix(on: boolean)` (строки 189-197)** — добавить глушение самоконтроля мика при входе в V-Mix.

OLD:
```ts
  /** TASK-015: v-Mix стерео-разводка ON/OFF. ON: defaultBranch глушится (иначе вокал задвоится center+L). */
  setVMix(on: boolean): void {
    const now = this.programInput.context.currentTime, r = now + 0.02;
    for (const g of [this._defaultBranch, this._vmixMaster]) g.gain.cancelScheduledValues(now);
    this._defaultBranch.gain.setValueAtTime(this._defaultBranch.gain.value, now);
    this._vmixMaster.gain.setValueAtTime(this._vmixMaster.gain.value, now);
    this._defaultBranch.gain.linearRampToValueAtTime(on ? 0 : 1, r);
    this._vmixMaster.gain.linearRampToValueAtTime(on ? 1 : 0, r);
    this.dumpState(`setVMix(${on})`);
  }
```

NEW:
```ts
  /** TASK-015: v-Mix стерео-разводка ON/OFF. ON: defaultBranch глушится (иначе вокал задвоится center+L). */
  setVMix(on: boolean): void {
    const now = this.programInput.context.currentTime, r = now + 0.02;
    for (const g of [this._defaultBranch, this._vmixMaster]) g.gain.cancelScheduledValues(now);
    this._defaultBranch.gain.setValueAtTime(this._defaultBranch.gain.value, now);
    this._vmixMaster.gain.setValueAtTime(this._vmixMaster.gain.value, now);
    this._defaultBranch.gain.linearRampToValueAtTime(on ? 0 : 1, r);
    this._vmixMaster.gain.linearRampToValueAtTime(on ? 1 : 0, r);
    // TASK-015 fix: в режиме V-Mix глушим самоконтроль мика (монитор = mono в оба уха),
    // иначе мик дублируется поверх V-Mix-R и слышен в обоих ушах. В V-Mix мик = только RIGHT.
    // Музыкальный монитор (_musicGain) не трогаем — артист продолжает слышать музыку.
    if (on) this.setMicMonitor(false);
    this.dumpState(`setVMix(${on})`);
  }
```

### Почему это корректно
- `setMicMonitor(false)` выставляет `_monitorGain.gain = 0` → глушит ТОЛЬКО мик-часть монитора (муз. монитор `_musicGain` отдельный, не затрагивается).
- V-Mix-мастер уже несёт мик на RIGHT (`vmixMicIn → merger ch1`), поэтому после глушения монитора мик слышен исключительно справа.
- Frozen-зоны не затронуты; изменение чисто аддитивное (1 строка в существующем методе).

## ✅ Верификация (Оператор обязан выполнить и отчитаться)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → ровно **314**.
2. `npx vitest run 2>&1 | tail -5` → **763 passed**.
3. Frozen-зоны нетронуты: `grep -nE "AudioEngineV2|patchV1|src/bridges|track.orchestrator" src/audio/engine-v3/monitor/MonitorRouter.ts` → 0 совпадений.
4. `git diff --stat` → только `MonitorRouter.ts`.

## 📝 Формат отчёта Оператора
- Строка 1: `APPLIED` / `FAILED`
- tsc count, vitest count
- git diff --stat
- Любые отклонения от old-якоря (если текст не совпал — СТОП, не угадывать).
