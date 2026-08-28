# MICRO-PACK V007-008 — TASK-015b: mic RIGHT-only in V-Mix (graph gate)

**Автор:** 007 (coordinator) · **Цепь:** 001 (architect ✅) → 002 (stress-test ✅ SAFE) → 009 (verify ✅ APPROVED) → Operator (apply)
**Статус:** READY · **Frozen:** НЕ ТРОГАТЬ (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-поля чужих классов)
**Канон:** `tsc --noEmit` ровно **314** · `vitest run` **763/763**

---

## 🐞 Баг (корень, подтверждён цепью)
В V-Mix мик должен быть ТОЛЬКО справа (вокал L / центр / мик R). V007-006 поправил фейдеры. Но мик слышен в ОБОИХ ушах, потому что самоконтроль-монитор (`micInput → _micDelay → _monitorGain → _monitorMaster → destination`, mono = оба уха) дублирует мик поверх V-Mix-R.
V007-007 попытался `setVMix(true) → setMicMonitor(false)`, но 🎤-тумблер (`ControlDeck.tsx:410` `router.setMicMonitor(true)`) **независимо** включает `_monitorGain` и перекрывает глушение (доказано в логе `MON-PROBE monitorGain=1`). Фикс на уровне тумблера проигрывает UI.

## 🎯 ПРАВИЛЬНОЕ решение (граф-гейт)
Сериальный гейт `_vmixMicGate` (GainNode, 1.0 по умолчанию) СТАВИТСЯ ПОСЛЕ `_monitorGain`, перед `_monitorMaster`. Слышимость мика = `_monitorGain`(UI) × `_vmixMicGate`(режим). В V-Mix → гейт=0 → мик-монитор глух в оба уха, мик слышен ТОЛЬКО через V-Mix-мастер (RIGHT). Иммунно к 🎤-тумблеру. `_musicGain → _monitorMaster` идёт МИМО гейта → муз. монитор не затронут. V007-007 отменяется (гейт авто-восстанавливает 🎤-состояние при V-Mix OFF). Инвариант файла «0 disconnect» соблюдён (только gain-автоматика).

## 🔧 Правки (1 файл: `src/audio/engine-v3/monitor/MonitorRouter.ts`)

### (a) Объявление поля — вместо
```ts
  private readonly _monitorGain: GainNode
  private readonly _monitorMaster: GainNode
```
→
```ts
  private readonly _monitorGain: GainNode
  /** TASK-015b: serial gate for mic self-monitor (_monitorGain → _monitorMaster). 1.0 normal; 0.0 = V-Mix ON. Immune to 🎤 toggle. _musicGain bypasses gate. */
  private readonly _vmixMicGate: GainNode
  private readonly _monitorMaster: GainNode
```

### (b1) Создание ноды — вместо
```ts
    this._monitorGain = ctx.createGain()
    this._monitorGain.gain.value = 0.0 // mic off by default
```
→
```ts
    this._monitorGain = ctx.createGain()
    this._monitorGain.gain.value = 0.0 // mic off by default

    this._vmixMicGate = ctx.createGain()
    this._vmixMicGate.gain.value = 1.0 // TASK-015b: mic self-monitor gate; 0.0 only in V-Mix
```

### (b2) Перекоммутация — вместо
```ts
    this.micInput.connect(this._micDelay)
    this._micDelay.connect(this._monitorGain)
    this._monitorGain.connect(this._monitorMaster)
```
→
```ts
    this.micInput.connect(this._micDelay)
    this._micDelay.connect(this._monitorGain)
    // TASK-015b: serial gate before monitor master (V-Mix mutes self-monitor at graph level)
    this._monitorGain.connect(this._vmixMicGate)
    this._vmixMicGate.connect(this._monitorMaster)
```

### (c) setVMix(on) — убрать строку V007-007, добавить рамп гейта
Вместо:
```ts
    // TASK-015 fix: в режиме V-Mix глушим самоконтроль мика (монитор = mono в оба уха),
    // иначе мик дублируется поверх V-Mix-R и слышен в обоих ушах. В V-Mix мик = только RIGHT.
    // Музыкальный монитор (_musicGain) не трогаем — артист продолжает слышать музыку.
    if (on) this.setMicMonitor(false);
```
→
```ts
    // TASK-015b (replaces V007-007): mic self-monitor muted by GRAPH gate _vmixMicGate,
    // NOT setMicMonitor(false) — otherwise 🎤-toggle (ControlDeck:410 → setMicMonitor(true)) overrides.
    // Gate is AFTER _monitorGain ⇒ 🎤 state preserved and auto-restores on V-Mix OFF.
    // _musicGain → _monitorMaster bypasses the gate — music monitor unaffected.
    this._vmixMicGate.gain.cancelScheduledValues(now);
    this._vmixMicGate.gain.setValueAtTime(this._vmixMicGate.gain.value, now);
    this._vmixMicGate.gain.linearRampToValueAtTime(on ? 0 : 1, r);
```

## ✅ Верификация (Operator)
1. `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **314**.
2. `npx vitest run 2>&1 | tail -5` → **763 passed**.
3. Frozen нетронуты: только `MonitorRouter.ts`.
4. `git diff --stat` → только `MonitorRouter.ts`.

## 📝 Отчёт Operator
`APPLIED`/`FAILED`, tsc_count, vitest, git_diff_stat, notes (при несовпадении якоря — СТОП).
