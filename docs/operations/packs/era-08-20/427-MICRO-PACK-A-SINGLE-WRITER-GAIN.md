# MICRO-PACK A (427) — SINGLE-WRITER effectiveGain в V3 (parity с V2, решения Ц3 по Явлениям A/C + катч mute)

## Контекст и эталон
**Эталон V2 (frozen-чтение, AudioEngineV2.ts):** все сеттеры (`setStemVolume`:1088, `setStemMute`:1105, `setStemSolo`:1121) идут через единый `_applyEffectiveGain` (:1144):
`effectiveMute = isMuted || (anySoloed && !isSoloed)` → `gain = effectiveMute ? 0 : rawVol * busVol`. Raw volume хранится отдельно (`_stemVolumes`) — снятие solo возвращает новую громкость. **V2 НЕ пробивается** ни solo, ни mute. Фикс = parity-восстановление.

**Дыры V3 (сессия 24.08):**
- A: `setStemVolume` (HybridPipelineService:474-482) пишет raw в stretchGain/stem.volume без solo-маски → фейдер Y при solo X пробивает маску.
- Катч mute (Ц3): `muteStem` (:463-471) при unmute ставит `stem?.volume ?? 1` без маски; `setStemVolume` замьюченного стема тоже пробивает mute (нет консультации mute).
- C: `getRouteCheckReport` `audible` (:407) = только `|masterGain| > EPS` — стемный effectiveGain не учтён.
- Restore: V3 не хранит raw отдельно — маска перезаписывает `stem.volume`, поэтому потребовались C25/C26 re-apply. После single-writer re-apply НЕ НУЖЕН (raw живёт в pipeline).

## Правки

### 1. `src/audio/engine-v3/pipeline/StemChain.ts` — аксессоры маски (новые, не frozen)

Добавить после `soloStem`/`_applySolo` (после строки 103):
```ts
  /** Solo-маска активна (есть хотя бы один засолоенный стем) */
  isSoloActive(): boolean {
    return this._soloed.size > 0
  }

  /** Стем слышим: solo-маска не активна ИЛИ стем в маске */
  isStemAudible(stemId: string): boolean {
    return this._soloed.size === 0 || this._soloed.has(stemId)
  }
```

### 2. `src/audio/engine-v3/pipeline/HybridPipelineService.ts` — single-writer

**2a. Новые поля** (рядом с `_stretchGains`, ~строка 63):
```ts
  /** Raw volume из UI (не трогается solo/mute) — parity V2._stemVolumes */
  private readonly _stemRawVolumes: Record<string, number> = {}
  /** Mute-состояние стема — parity V2._stemMutes */
  private readonly _stemMuted: Record<string, boolean> = {}
```

**2b. Чистая функция + единый writer** (в Private-секцию, рядом с `_rampGain`):
```ts
  /** Эффективный гейн стема: 0 при mute или вне solo-маски, иначе raw volume (parity V2._applyEffectiveGain) */
  private _effectiveGainOf(stemId: string): number {
    const raw = this._stemRawVolumes[stemId] ?? 1
    const muted = this._stemMuted[stemId] === true
    const audible = this._chainA.isStemAudible(stemId)
    return muted || !audible ? 0 : Math.max(0, Math.min(1, raw))
  }

  /** ЕДИНСТВЕННЫЙ writer гейна: stretchGain + stem.volume из _effectiveGainOf */
  private _applyEffectiveGain(stemId: string): void {
    const target = this._effectiveGainOf(stemId)
    const sg = this._stretchGains.get(stemId)
    if (sg) this._rampGain(sg, target)
    const stem = this._chainA.stems.get(stemId)
    if (stem) stem.volume = target
  }
```

**2c. `setStemVolume` — заменить тело (:473-482):**
```ts
  /** Плавная регулировка громкости стема (для UI fader). raw сохраняется; solo/mute применятся автоматически */
  setStemVolume(stemId: string, volume: number): void {
    this._stemRawVolumes[stemId] = Math.max(0, Math.min(1, volume))
    this._applyEffectiveGain(stemId)
  }
```

**2d. `muteStem` — заменить тело (:463-471):**
```ts
  muteStem(stemId: string, muted: boolean): void {
    this._stemMuted[stemId] = muted
    this._applyEffectiveGain(stemId)
  }
```

**2e. `soloStem` — заменить тело (:489-496):**
```ts
  soloStem(stemId: string, soloed: boolean): void {
    this._chainA.soloStem(stemId, soloed)
    // Single-writer: пересчитываем ВСЕ гейны по маске
    for (const id of this._chainA.stems.keys()) this._applyEffectiveGain(id)
  }
```

**2f. `getRouteCheckReport` (Явление C) — audible (:407):**
```ts
          audible: Math.abs(masterGain) > ROUTE_CHECK_EPSILON && this._effectiveGainOf(stemId) > ROUTE_CHECK_EPSILON,
```

### 3. `src/foundation/reactions/stem-engine-sync.ts` — удалить SOLO-RESTORE re-apply (C25/C26 избыточен)

В V3-ветке solo-блока удалить блок (комментарий `// 🔧 SOLO-RESTORE (баг сессии 24.08)` + цикл re-apply) — pipeline теперь сам применяет маску и хранит raw. Оставить только цикл soloStem. При желании — комментарий:
```ts
      // Solo-маска применяется в pipeline (single-writer effectiveGain, пак A) — re-apply не нужен
```

### 4. Fallback-аудит (Ц3)
`stem-engine-sync.ts:149/227` — `const stem = t3.orchestrator.get(id); if (stem) stem.volume = vol` — в V3-режиме orchestrator пуст (MP-23) = no-op. **Оставить как есть**, добавить в строку 149 комментарий:
```ts
        // ⚠️ fallback-путь: no-op в V3 (orchestrator пуст, MP-23). Защита гейна — в pipeline single-writer (пак A).
```
Строку 227 не трогать (applyAll — cold-start, оркестратор так же пуст).

### 5. Doc-строки (Ц3: критичные — сейчас)
`docs/AUDIO-BEHAVIOR-SPEC.md` MX-03 — обновить статус и добавить V3-рестейт:
```
| MX-03 | solo глушит остальные, снятие восстанавливает прежние gain | оба | ✅ v3 (single-writer effectiveGain, пак A 24.08) |
```
Рядом — примечание:
```
V3-рестейт MX-03: effectiveGain(stemId) = mute||(soloActive && !soloed) ? 0 : rawVolume.
Raw volume хранится отдельно от применяемого гейна (пак A) — изменение фейдера при активном solo
обновляет raw, снятие solo возвращает новую громкость. Мute не пробивается изменением громкости.
```

## Верификация (007)
- `npx tsc --noEmit` → 314.
- `npx vitest run` → 749/749 (2 legacy-suites — предсуществующие, не регрессия).
- Проверить: `chainA.muteStem` и `chainA.setStemVolume` после пак A — кто ещё вызывает (должны остаться неиспользуемыми из pipeline; публичный API StemChain не удалять).
- Frozen: только чтение V2. Правки: StemChain (аксессоры), HybridPipelineService, stem-engine-sync (удаление re-apply), AUDIO-BEHAVIOR-SPEC.md. `_stemRawVolumes`/`_stemMuted` — новые приватные поля pipeline (не frozen-зона).
- Коммит: `C27: single-writer effectiveGain в V3 (parity V2) — solo/mute не пробиваются фейдером, RouteCheck effective-aware, MX-03 рестейт` + `(427-REPORT)`.
- Живой ретест (пользователь): solo X → фейдер Y → тишина → снять solo → Y с новой громкостью; mute-чек: замьютить Y → фейдер Y → тишина.