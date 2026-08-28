# MICRO-PACK: V3ACTIVE-RESTORE (009-W2b-restore + 002-P1) · 28.08

> Цепь: 001(v1, вариант A) → 002(ТРЕБУЕТ ПАТЧА: P1+усиление) → 009(РЕШЕНО) → 001(финальная пропись) → 007-верификация (дрейф `true`→`false` пойман и исправлен).
> Канон: tsc=302 / vitest=761+5int+2load / PARITY PASS / frozen-guard GREEN. HEAD на момент упаковки: `a7aab6a` (docs-only от Mac; src-якоря проверены 007 вручную).
> Баг: W2b (d0e31af) удалил единственный writer `window.__v3Active` → все фейдеры акустически мертвы в V3 (store→pipeline гейтится мёртвым флагом), красный мастер-фейдер уходит в no-op-фасад, FR-014 обнуляет instrumental.

## СКОУП: 2 файла, +4 строки, −0. Frozen НЕ трогать.

### ПРАВКА-1 · src/main.tsx (bootAether, между :90 и :91)

old (точно):
```ts
  try {
    const transport = getTransport()
```

new (точно; бутстрап **false** — семантика утверждена цепью: флаг = «V3 сейчас играет/мастер», НЕ «pipeline привёрнут»):
```ts
  try {
    // 009-W2b-restore: единственный writer флага V3 (удалён в W2b, d0e31af)
    ;(window as any).__v3Active = false
    ;(window as any).__setV3Active = (active: boolean) => { (window as any).__v3Active = active === true }
    const transport = getTransport()
```

### ПРАВКА-2 · src/audio/engine-v3/integration/V3DataInterceptor.ts (между :175 и :176)

old (точно):
```ts
        await Promise.race([this.transport.play(offset), timeoutPromise])
        console.log('[V3DataInterceptor] 🎯 Auto-play V3 at', offset.toFixed(1) + 's')
```

new (точно):
```ts
        await Promise.race([this.transport.play(offset), timeoutPromise])
        // P1: тихий возврат play() без 'playing' (TransportV3.ts:135-155) = фейл → catch :177 → rollback
        if (this.transport.state !== 'playing') throw new Error('V3 play() resolved without playing state')
        console.log('[V3DataInterceptor] 🎯 Auto-play V3 at', offset.toFixed(1) + 's')
```

## ГЕЙТЫ ДО (стоп при несовпадении)

```bash
git rev-parse --short HEAD                # = a7aab6a (или новее docs-only; src-якоря те же)
grep -rnP "\(window as any\)\.__v3Active\s*=(?!=)" src/ --exclude-dir=__tests__   # = 0
grep -rn "__setV3Active\s*=" src/         # = 0
```
Frozen SHA baseline уже снят 007: `/tmp/opencode/frozen-pre-v3active.sha` (21 файл).

## ГЕЙТЫ ПОСЛЕ (все обязаны совпасть; иначе откат `git checkout -- src/main.tsx src/audio/engine-v3/integration/V3DataInterceptor.ts`)

```bash
grep -rnP "\(window as any\)\.__v3Active\s*=(?!=)" src/ --exclude-dir=__tests__   # ровно 2 строки, обе src/main.tsx
grep -rn "__setV3Active\s*=" src/         # ровно 1 строка, src/main.tsx
git diff --stat -- src/main.tsx src/audio/engine-v3/integration/V3DataInterceptor.ts  # только 2 файла, +4 −0 (комменты не в счёт строк кода)
git diff --name-only -- src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/bridges src/services/track.orchestrator.ts  # = 0 строк
npx tsc --noEmit 2>&1 | grep -c "error TS"   # = 302
npx vitest run                            # 761 passed + 5 intentional fail + 2 load-fail
npm run verify:ci                         # PARITY PASS
node team-m/bLb/frozen-guard.mjs          # 🟢 GREEN
find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum > /tmp/opencode/frozen-post-v3active.sha
diff /tmp/opencode/frozen-pre-v3active.sha /tmp/opencode/frozen-post-v3active.sha && echo "FROZEN BYTE-IDENTICAL"
```

Известная bianca-база (НЕ нарушения, существуют ДО пака, не менять): ControlDeck.tsx:64 (`const __v3Active = !!...` — читатель), takes.duck.ts:60 (`=== false` — читатель). Тесты-писатели флага (BusFader18.test.ts:383+, stem-engine-sync.test.ts:112/134/147) НЕ трогать — 5 intentional fails остаются intentional.

## СМОУК БОССУ (после применения)

`npm run dev` → DevTools/Console → загрузить трек со стемами:
- Успех: `🎯 Auto-play V3 at 0.0s` → в консоли `__v3Active === true`; красный Inst-фейдер слышно управляет минусом (music-bus); пер-стем фейдеры отзываются по отдельности.
- Фейл (P1 сработал): `❌ V3 activation failed — V3-native recovery: Error: V3 play() resolved without playing state` → `__v3Active === false` + crash-модалка.
- Sanity: `__setV3Active(false)` в консоли → красный фейдер переключается в V2-ветку (no-op, V2 мёртв post-W3 — ожидаемо).

## OUT OF SCOPE (очередь, НЕ в этот пак)

- P2: coldSync re-arm в stem-engine-sync (ходы фейдеров в flag=false-окне загрузки) — отдельный микро-пак.
- P3: takes.duck.ts MP-23-предикат (duck мёртв на stem-треках) — отдельный микро-пак.
- `belive:v3-activation-failed` — мёртвое событие (0 слушателей) → подключение AudioCrashModal отдельным заходом.
- 'other'-стем: наблюдать (в логе Босса 5 стемов без decode-фейлов → вероятно нет в IDB-записи трека; защита BAC-002/04ed754 на месте).
