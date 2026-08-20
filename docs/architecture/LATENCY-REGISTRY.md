# LATENCY-REGISTRY — Реестр задержек и обработок голоса

> **НОРМАТИВНЫЙ ДОКУМЕНТ** (по решению Ц3 от 20.08.2026). Живёт в `docs/architecture/` — версионируется, попадает под DOC-CHECK. Зона `007_08.08/` gitignored — туда реестр НЕ возвращается.
> **F5-enforcement (⛔-протокол):** любой MICRO-PACK, трогающий аудиограф, обязан включать delta-строку реестра (новая строка D или правка B/C) — иначе пак не принимается на ⛔.
> **Единственный источник истины** для G0-fingerprint (latencyHint + baseLatency × rate) и E7 dual-rate.

**Ведёт:** 007 · **Живой документ** (пополняется при каждой новой обработке/примочке)

---

## A. БАЗОВЫЕ ЗАДЕРЖКИ ПЛАТФОРМЫ (измеряются, из JS не управляются)

| Параметр | rate | Значение | Методика |
|---|---|---|---|
| Input (mic, WASAPI shared) | общий | ~10-15ms | аппаратно |
| Output (буфер + драйвер) | общий | latencyHint `interactive` → буфер 5-10ms + драйвер 5-15ms | C14 (402) |
| baseLatency | 44.1kHz | TBD (замер) | ctx.baseLatency — G0-fingerprint |
| baseLatency | 48kHz | TBD (замер) | ctx.baseLatency — G0-fingerprint, E7 dual-rate |
| **RTL голос (эталон)** | общий | **47ms при `playback` → ~15-25ms при `interactive`** | замер пользователя |

**Правило:** флип latencyHint = новая G-кампания (env-fingerprint += latencyHint + baseLatency × rate). Замер RTL — той же методикой до/после каждой обработки.

## B. ПРОГРАММНЫЕ ЗАДЕЛЖКИ (управляемые, компенсируемые)

| # | Источник | Значение | Где | Статус |
|---|---|---|---|---|
| B1 | STFT Signalsmith (stretch) | `intervalMs 20` (blockMs 40) | StretchInstance.ts:57-61, Bus A | активен при stretch |
| B2 | Bus B DelayNode | 22.67ms (STFT 20 + scheduling 2.67) | StemChain.ts:16,42-43 | pure-varispeed → `setBusBDelay(0)` ✅ |
| B3 | MonitorRouter `_mainDelay` | createDelay(1.0), delayMs конфиг | MonitorRouter.ts:53 | SPLIT-мониторинг; **G14: дефолт 120ms — проверить в проводном** |
| B4 | MonitorRouter `_micDelay` | createDelay(1.0) | MonitorRouter.ts:56 | мониторная компенсация микрофона; **G14: не молча 120ms** |
| B5 | V2-граф (mic→merger→dest) | 0ms | VocalMix.ts | чистый merger |
| B6 | Render quantum V3 | ~2.9ms (128/44.1k) | TransportV3.ts:117 | — |

## C. КОМПЕНСАЦИИ (точки, где задержка уже компенсируется)

| Компенсация | Зачем | Реализация |
|---|---|---|
| Bus B delay | синхронизация Bus A (STFT) и Bus B (varispeed) | StemChain.setBusBDelay |
| `_micDelay` | мониторный выход ≠ live для микрофона | MonitorRouter, delayMs |
| compensateOn (monitor/main) | выбор стороны компенсации | MonitorRouter.setCompensateTarget |

## D. ОБРАБОТКИ ГОЛОСА (текущие и планируемые)

| Обработка | Статус | Точка включения | Latency-профиль | Примечание |
|---|---|---|---|---|
| Микрофон raw | спека готова (R9), WS-1 | `micInput → _micDelay → _monitorGain → _monitorMaster` | input ~10ms | constraints exact; setDeviceId C11 |
| VocalHall (вокал в зал) | ✅ C15 (C+D, R1+R2) | тап `instance.outputNode → _vocalHallSend → vocalHallInput → _vocalHallGain → _mainDelay` | гейн-тап ~0 задержки; задержка живёт в `_mainDelay` | pre-fader (mute/solo/volume вокала не трогают зал); дефолт trim 0.2 |
| AutoMix | legacy-точность (R6) | `vocalHallInput.gain` (рампы) | — | exact-match + strict zero |
| **Примочки (компрессор, реверб, pitch, фиксы)** | 🔮 ПЛАНИРУЕТСЯ | **TBD** (для каждой — строка в этом реестре) | **меряется до имплементации** | правило: см. F |

## E. МЕТОДИКА ИЗМЕРЕНИЯ (для каждой новой обработки)
1. **testPulse** — 1kHz / 60ms (PulseCalibrator, legacy-семантика G15)
2. **Impulse harness** — impulse-test-harness.ts (44100, capture buffer, точный замер)
3. **RTL голоса** — замер пользователя той же методикой (эталон A), фиксируется в H
4. Каждая примочка: замер **ДО/ПОСЛЕ** включения → запись в реестр (B/D) → решение: компенсация delay-нодой или допустимо

## F. ИНВАРИАНТЫ (жёсткие)
1. Тапы голоса — **PRE-FADER** (стенд R1, эталон V2 vocalsSourceNode)
2. Никакая обработка **in-series в main-путь** без компенсации (подход Bus B)
3. Параллельный тап не трогает main-путь — **duck-инвариант Ц3-1/B.3** (см. M4-DESIGN §B.3; ссылаемся, не дублируем формулировки)
4. latencyHint зафиксирован в env-fingerprint (G0-протокол)
5. **Примочка без latency-записи в реестре — запрещена** (F5-enforcement: delta-строка в каждом MICRO-PACK, трогающем аудиограф)

## G. ОТКРЫТЫЕ ВОПРОСЫ
- G14: дефолт `_micDelay`/`_mainDelay` в проводном режиме (не молча 120ms)
- Компрессор: lookahead-латенция — выбрать профиль до имплементации
- Уровень CDP-драйва: какие latency-инварианты доказуемы статически (граф, гейны, delayTime) — спек Ц2
- baseLatency × rate (44.1/48): фактические значения — замер в ближайшую живую сессию

## H. ХРОНОЛОГИЯ ЗАМЕРОВ

| Дата | Что | rate | До | После | Гейт |
|---|---|---|---|---|---|
| 20.08 | latencyHint playback→interactive (C14) | общий | 47ms (субъект.) | ~15-25ms, «намного быстрее, комфортно» (субъект. ✅); цифра повторно не снималась | удержан |
| 20.08 | vocalHall pre-fader тап (C15) | общий | — | ~0 (гейн-тап, delay в _mainDelay) | статика + живые уши (V3-сессия) |