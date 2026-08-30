# MICRO-PACK C25 — SOLO-RESTORE: после отжатия solo возвращать ползунковые значения (баг сессии 24.08)

## Контекст
Баг найден живьём (сессия бандла, пользователь): играли vocals+bass, остальные ползунки на 0 → solo на vocals → отжать solo → **зазвучали ВСЕ стемы**.

**Корень:** `src/audio/engine-v3/pipeline/StemChain.ts:96-98` — `_applySolo()` при `_soloed.size === 0` ставит ВСЕМ стемам `volume = 1` (не хранит snapshot до solo).

**Почему sync не спасает:** `src/foundation/reactions/stem-engine-sync.ts` `diffAndApply` — diff-based. Volume в сторе не менялся (пользователь не трогал ползунки) → volume-блок (строки 136-154) не переприменяет. Solo-блок (169-186) идёт после и `soloStem` перезаписывает все volume единицами.

**Правильный фикс — переприменение effectiveGain из стора (source of truth) после solo-изменений.** `effectiveGain(state, id)` уже учитывает: stemsEnabled (FR-014), solo-маску (solo-стем=raw, остальные=0), mute (→0). Не трогаем StemChain (движок) — чиним на слое синхронизации.

## Шаг 1 — `src/foundation/reactions/stem-engine-sync.ts`

В `diffAndApply`, V3-ветка solo-блока (сейчас строки 171-178):

```ts
    if (t3) {
      // V3: solo через pipeline.soloStem() (359: ветка была пустой — solo не доходил)
      for (const id of Object.keys(current.stemSolos)) {
        if (current.stemSolos[id] !== prev.stemSolos[id]) {
          const pipeline = (window as any).__belive?.pipeline
          if (pipeline?.soloStem) pipeline.soloStem(id, current.stemSolos[id])
        }
      }
    } else if (isV2) {
```

заменить на:

```ts
    if (t3) {
      // V3: solo через pipeline.soloStem() (359: ветка была пустой — solo не доходил)
      for (const id of Object.keys(current.stemSolos)) {
        if (current.stemSolos[id] !== prev.stemSolos[id]) {
          const pipeline = (window as any).__belive?.pipeline
          if (pipeline?.soloStem) pipeline.soloStem(id, current.stemSolos[id])
        }
      }
      // 🔧 SOLO-RESTORE (баг сессии 24.08): StemChain._applySolo при отжатии
      // последнего solo ставит ВСЕМ стемам volume=1 (не хранит snapshot до solo).
      // Переприменяем effectiveGain из стора (source of truth): ползунковые значения
      // возвращаются, активная solo-маска сохраняется, mute учитывается.
      const pipeline = (window as any).__belive?.pipeline
      for (const id of Object.keys(current.stemVolumes)) {
        const vol = effectiveGain(current, id)
        if (pipeline?.setStemVolume) pipeline.setStemVolume(id, vol)
        const stem = t3.orchestrator.get(id)
        if (stem) stem.volume = vol
      }
    } else if (isV2) {
```

Одна правка. Frozen чисто (StemChain не трогаем).

## Верификация (007)
- `npx tsc --noEmit` → 314.
- `npx vitest run` → 749/749.
- Проверить: нет ли прямых вызовов `pipeline.soloStem` вне stem-engine-sync (единственный потребитель — иначе фикс неполный).
- Коммит: `C25: SOLO-RESTORE — после отжатия solo возвращаются ползунковые volume (effectiveGain re-apply, баг сессии 24.08)` + `(425-REPORT) в message`.
- Живая проверка — пользователь в сессии (solo on/off после фикса).