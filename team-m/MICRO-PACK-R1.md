---
status: DECISION-PACK (ready to apply) · 2026-08-25 · agent: 007_Hub
basis: mac-007 r1-c3-proposal.md (ready-for-c3) + Ц3 аппрув 25.08
frozen: NONE (V3DataInterceptor.ts = engine-v3/integration, не в frozen-списке)
---

# MICRO-PACK-R1 — generation-check на ВЕСЬ rollback-catch (+ после loadStem)

## Context (P1, Ц3 APPROVED 25.08)
`V3DataInterceptor.ts:166-178` (catch play-timeout): при смене трека во время 5s play-timeout старый catch гасит `__v3Active(false)` у УЖЕ ИГРАЮЩЕГО нового трека (zombie-window), трогает общий pipeline и стреляет crash-событием в UI.

Ц3: whole-catch generation-check + чек после `decode+reset+loadStem×N` — наш отработанный паттерн (seek-generation в TransportV3, previewGen в takes). **cage.deactivate() владение отложено** в fallback-пак (Ц3: deactivate зовётся из rollback-ветки/fail-init пути V3DataInterceptor, НЕ из bootAether, и только в составе fallback-пака, иначе — мёртвая ветка без живого fallback).

## Fix
### 1. В начале async loadTrack — capture generation
```ts
const myGeneration = this._loadGeneration
```
(рядом с существующим инкрементом `_loadGeneration` в loadTrack).

### 2. Оборачиваем ВЕСЬ catch (:166-178)
```ts
} catch (error) {
  if (myGeneration !== this._loadGeneration) {
    console.log('[V3DataInterceptor] stale rollback skipped — track superseded')
    return                                   // ⬅ НИЧЕГО не делать: новый лад владеет pipeline/флагом/UI
  }
  try { this._pipeline?.stop() } catch {}
  try { (window as any).__setV3Active(false) } catch {}
  try { this.transport.pause?.() ?? this.transport.stop?.() } catch {}
  window.dispatchEvent(new CustomEvent('belive:v3-activation-failed', { detail: { error: String(error) } }))
}
```

### 3. generation-check ПОСЛЕ decode+reset+loadStem×N (:104-179)
Самая долгая фаза без re-check: протухший лад успевает активировать клетку и запустить старый трек. Сразу после цикла `loadStem×N` (перед `track-loaded` dispatch) добавить:
```ts
if (myGeneration !== this._loadGeneration) {
  console.log('[V3DataInterceptor] stale load aborted — track superseded')
  return
}
```
(без side-effect'ов — просто не активируем клетку/флаг для протухшего лада).

## Verify
- `npx tsc --noEmit` → 0 new (313); `npx vitest run` → 769.
- CDP-драйв: старт лада A → немедленно лад B во время play-timeout → B играет, флаг не падает, crash-modal нет.
- proof-of-change: трейс-дифф — при смене лада в окне timeout старый catch возвращает early (лог `stale rollback skipped`).
- cage.deactivate() НЕ вызывается здесь (ждёт fallback-пак).

## Notes
- Frozen: НЕ трогаем AudioEngineV2/patchV1/bridges/track.orchestrator.
- Применять ПОСЛЕ E1/B-slice/A1A2/B1/SURFACE в составе Operator-поезда (Ц3 §8).
