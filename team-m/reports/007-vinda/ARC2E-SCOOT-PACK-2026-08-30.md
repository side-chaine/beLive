
## 6. 🎯 ГЛАВНАЯ НАХОДКА (добор 007): _vocalHallSend = ГОТОВЫЙ фейдеронезависимый vocal-тап

- HPS:75-77 — `private readonly _vocalHallSend: GainNode` — комментарий: **«pre-fader vocal hall send — тап от instance.outputNode (ДО stretchGain), только vocals. Mute/solo/volume (все идут через stretchGain) НЕ влияют на зал»** — это ровно тот фейдеронезависимый эталон, которого Hy4 требовал в Q6/BRG-4!
- Подключение при загрузке вокал-стема: HPS:222-223 (`instance.outputNode.connect(this._vocalHallSend)`, при смене — disconnect старого :222).
- `_vocalHallMeter` (:101-103, fftSize=256) уже висит на нём (для BRG-4-кросс-чека; низкое fftSize — отдельная тема, НЕ питч).
- **Приватный** — нужен публичный геттер в HPS (1 строка, не frozen): `get vocalReferenceTap(): AudioNode | null`.
- Питч-движку узел идеален: `initFromNode(node)` вешает СВОЙ analyser fftSize=2048 (низкочастотное разрешение питча ок), `retarget(node)` для hot-swap при смене трека.

**Схема vocal-ревайринга PitchTab:** `ae?.vocalsGain + ae?.stems?.has('vocals')` → `pipeline?.vocalReferenceTap` (+ проверка живости вокал-стема). Фейдеронезависимость — by design узла, не наша забота.

— 007 · 30.08 · добор §6
