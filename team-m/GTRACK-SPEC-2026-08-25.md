# SPEC-GTRACK v1.0 — Gate 3B Measurement Track (425 + G4) · 2026-08-25 · агент: general (read-only)

**Статус:** implementable specification из PLAN-v3.3-CANONICAL.md §6. Read-only basis; frozen зоны не трогаем (AudioEngineV2/patchV1/bridges/track.orchestrator — «frozen audio-core, read-only per protocol»). Все названные файлы ниже — НЕ frozen.

**Нормативные источники:** PLAN §2/§6 · LATENCY-REGISTRY · 425-G0-DRAFT · C27/C28/C29 packs · team-m/PARITY-LEDGER.md · `src/audio/engine-v3/pipeline/HybridPipelineService.ts`.

## §1. Fingerprint schema
| # | Field | Type | Source |
|---|-------|------|--------|
|1|`latencyHint`|string|audioContext.ts:14 (C14). Flip = НОВАЯ кампания|
|2|`baseLatency`|float s|`ctx.baseLatency` при буте|
|3|`rate`|int Hz|`ctx.sampleRate` ∈ {44100,48000}|
|4|`sha`|{commit,dirty}|git SHA дерева сборки|
|5|`chrome`|string|версия headless|
|6|`os`|string|Windows host via WSL|
|7|`hardware`|{cores,ua}|navigator.hardwareConcurrency + UA|
|8|`v3Engine`|'v2'\|'v3'|import.meta.env.VITE_ENGINE (обязателен)|
|9|`micDeviceId`|'default'\|id|localStorage mic:deviceId|
|10|`audioOutputDevice`|'default'\|id|monitor device|

SHA = `git rev-parse HEAD` + `dirty = !git diff --quiet`. `fingerprintId` = first 16 hex SHA-256(canonicalJson). `campaignKey` = (latencyHint, baseLatency, rate, sha, v3Engine, micDeviceId, audioOutputDevice); flip любого (кроме chrome/os/hardware) ⇒ новая кампания.

## §2. Envelope-document
Граф (факты из `HybridPipelineService.ts`): single path `_busAGain=1.0` always, `_busBGain=0` dead, switchBackend disabled; meter tap = per-stem AnalyserNode(fftSize256) на `stretchGain` (post-volume/mute/solo); effectiveGain = 0 для crashed/muted/вне solo, иначе raw×busFactor, single-writer `_applyEffectiveGain` 15ms ramp. Диагностическая поверхность: `window.__belive.pipeline` (getStemMeterLevel, getVocalHallLevel, getRouteCheckReport, stretchPool, ctx).
UI bounds: foreground-tab only (background throttles rAF → 250ms); MixerPanel meter poll tier 10/20/30/60 fps.
Asymmetries: ASYM-1 50ms cache (V3StatePublisher TICK_EPSILON 0.05), ASYM-2 throttled-rAF bg, ASYM-3 MediaRecorder cold ~4.8s, ASYM-4 rate debounce 50ms (RateThrottler 20Hz), ASYM-5 gain ramp 15ms.

## §3. G4 discriminator
`D(s,w) = M(s,w) / (I(s,w) × R(s))` где M = mean RMS getStemMeterLevel (post-stretchGain), I = mean RMS того же инстанса pre-stretchGain (parallel tap С Ц2 diff-check строкой), R = raw volume [0..1]. Assertion: |D − D_cal(rate)| ≤ τ(rate). Masked (mute/solo/dead) ⇒ M=0 ⇒ D:=0 (не violation). Denominator = RAW (не effective) — иначе маски съедают чувствительность.
Параметры (В-6): X points per rate; T_sus ≥ 2×W (W=200ms ⇒ ≥400ms); ε_floor УДАЛЁН. Warmup ≥1.5s (калибр. точка 24.08), мин 2 измерения с шагом ≥1.5s. Duck-invariant: AutoMix duck = setTargetAtTime ramps на vocalHallInput.gain, hall send PRE-fader parallel ⇒ D в τ, hall независим. Blind zone muted-vocals∧AutoMix → G5 boundaries (не скорится). Storm: transition-guard перезапускает warmup, окна внутри мутации отбрасываются+счётчик; appliedRate==commandedRate asserted. Watchdog N/A by design в V3-fallback.

## §4. Runner (unattended)
Core: `.mjs` sweeps (cdp-sweep, v3-sweep; Chrome headless WSL; CDP 9222/9223). E-endpoint primary (обязателен submit), X-endpoint (verdict only). Budget: **112 accounted / 120 cap / ≤8 retries** (№8 closed). Escalation: превышение budget/timebox или systematic infra-error ⇒ СТОП+отчёт Ц3. Outcomes (ровно 5): `passed|failed|infra-error|config-drift|bounded out-of-envelope closure`. Слово "inconclusive" ЗАПРЕЩЕНО. infra-error ≠ result, корреляция с configs по fingerprintId. Thresholds из G1-baseline (не хардкодить).

## §5. Acceptance checklist (15 пунктов)
fingerprint 10 полей+canonical order+derivable fingerprintId · campaign-flip rule · envelope-doc file:line facts vs HybridPipelineService · parallel tap Ц2 diff-check строка · G4 formula+masked⇒0+ε_floor absent · warmup≥1.5s+≥2 samples · storm discard-counter+applied==commanded · duck-invariant CDP transcript · blind-zone tagged g5-boundary · watchdog absent from scoring · 5-outcome enum exact+no "inconclusive" · infra-error block+correlation · budget counters+escalation halt · thresholds from G1 (empty until lands) · frozen untouched.

— general · read-only
