# 005-B · DSP-паттерны эффектов Studio (WebAudio) · этап-2 прогона Studio

**Дата:** 2026-09-06 · **Автор:** 005-B (исследователь WebAudio) · **Статус:** сдано 001/диспетчеру
**Вердикт-вставка:** INSERT-обёртка (сухой вход→FX→выход) между `_micDelay` и `_monitorGain`, создаётся в constructor (конституция MonitorRouter «0 disconnect в runtime» не нарушается), bypass = 20ms linearRamp crossfade (канон TC-2C setRouteMain/setVMix).

## Скелеты эффектов
| Эффект | Узлы | Параметры | Bypass |
|---|---|---|---|
| **Mic Character** | inputGain(drive) → shaperA+shaperB (A/B параллельно) → dryGain+wetA+wetB → outGain(makeup) | drive рампится setTargetAtTime; кривые tanh-семейство/tanh(k·x)/tanh(k), MDN-формула; oversample="4x" | crossfade dry/A/B 20ms (curve НЕ рампится — атрибут; A/B-шейперы = единственный бесшовный путь) |
| **Echo** | sendGain → delay → feedbackGain → (обратно в delay); delay → wetGain → out; input → dryGain → out | delayTime a-rate (рамп); feedback 0..0.85; **sync-to-BPM: 60/bpm × {0.25, 0.375, 0.5}** (1/4, dotted-1/8, 1/8); BPM-источник = useTrackInfoStore.meta?.bpm (вне engine-v3, стык параметром) | wetGain→0 рампом; feedback-петля живёт тихо (0 disconnect); цикл легален (спека: delay ≥ render quantum рвёт цикл) |
| **Vocal Tone** | bq1(lowshelf ~250Hz) → bq2(peaking ~3kHz Q≈1) → bq3(highshelf ~9kHz) | пресеты: warm {+2/-1.5/-2dB} · bright {-1/+2.5@3.5k/+2.5} · tele {highpass 300Hz + lowpass 3.4kHz} | рамп gain→0 = плоская АЧХ (математика shelf/peaking) — ноль доп-узлов; смена типа пресета = рамп→свап→рамп (~40ms) |

## Гейт-инвариант (КРИТИЧНО)
Вставка строго ДО `_monitorGain` → `_vmixMicGate` гейтит и FX-сигнал, и эхо-хвосты: V-Mix ON = полная тишина самоконтроля. Вставка ПОСЛЕ гейта пустила бы эхо-хвосты мимо гейта — **запрещено**.
**Флаг B04 (не наш код):** тап `micInput → vmixMicIn` (:156) стоит ДО delay и FX → V-Mix R-канал всегда слышит СУХОЙ мик; если Character/Tone должны красить V-Mix — точку тапа двигает зона Split.

## INSERT vs SEND/RETURN — вердикт
INSERT для всех трёх: Character/Tone в параллели = фазовые биения/comb-filtering (физика), Echo получает wet/dry параллельно ВНУТРИ обёртки (эквивалент send/return без второго тапа и риска обойти гейт). Один insert-слот = один AnalyserNode-тап (конвенция V3: тап после гейна) = предсказуемая латентность.

## Точки входа для 002-стресса (передано)
латентность insert (dry=0, wet=delayTime) · дуальность тапа vmixMicIn (сухой V-Mix vs обработанный монитор) · гейт-инвариант (FX строго до _monitorGain) · рампы bypass 20ms · глиссандо-артефакт рампа delayTime · Tele-смена type biquad.

**Обходы:** curve-свап щелчок → A/B-шейперы · рамп delayTime pitch-эффект → setTargetAtTime τ≈30ms · oversample="4x" против алиасинга.
**НЕ НАЙДЕНО:** готовых пресетов «mic character» в стандарте (кривые строим из tanh-семейства) · BPM внутри engine-v3 (0 grep — только useTrackInfoStore) · ConvolverNode вне первого круга (сознательно).

**Источники:** W3C Web Audio spec (Context7 /websites/webaudio_github_io_web-audio-api: WaveShaper/Delay/Biquad/AudioParam automation/cycles) · MDN (/mdn/content: makeDistortionCurve, oversample) · репо: MonitorRouter.ts (граф :140-156, конституция :5-6, setVMix :189, гейт :198), StemChain.ts:42-45, HybridPipelineService.ts:62-64, useBillyLocomotion.ts:101, track-meta.types.ts:21.
