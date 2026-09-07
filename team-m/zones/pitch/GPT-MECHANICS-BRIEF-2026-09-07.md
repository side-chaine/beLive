# 📘 GPT-MECHANICS-BRIEF · beLive Pitch — полная механика спроектированного продукта (слово проектировщика)
**Дата:** 2026-09-07 12:00 · **Источник:** Никита запросил у GPT (автора концепта-референсов) описание механики; ответ передан зоне B06 verbatim через Никиту.
**Назначение:** вход для прогонов 001/005/002/009 — проектировщик описал СУТЬ системы, которую мы строим. Этот документ = канон-рамка направления.

---

## 0. ОПРЕДЕЛЕНИЕ (ядро, цитата проектировщика)

> **beLive Pitch — это не «тюнер» и не просто определитель нот. Это realtime-система, которая знает эталонную вокальную траекторию, одновременно слышит пользователя и в каждый момент понимает: где сейчас находится голос, какую ноту он поёт, насколько уверенно детектирован pitch и насколько он отклоняется от эталона.**

Слои ответственности (цитата):
```
Audio Engine отвечает за правду.      (сырой F0-поток)
Pitch Engine отвечает за интерпретацию. (ноты/центы/состояния)
TrackMap отвечает за музыкальный контекст. (где в песне)
AI Coach отвечает за объяснение, что делать дальше.
UI превращает это в ощущение живого музыкального инструмента.
```

## 1. ПАЙПЛАЙН (концепт проектировщика, канон-рамка)

```
Mic → Pre-processing → VAD (voice/silence/breath/noise/unvoiced-консонанты) → F0 Detection
→ Confidence → Note estimation → Reference alignment → Pitch deviation (центы)
→ Scoring/feedback → Visualization
```

Ссылочная траектория (Reference) = offline-анализ вокальной дорожки при подготовке Track ZIP:
```
reference vocal → offline pitch analysis → F0 curve → note segmentation → confidence → JSON
{start, end, f0[], note, midi}
```

## 2. КЛЮЧЕВЫЕ ТРЕБОВАНИЯ ПРОЕКТИРОВЩИКА (выжимка 24 пунктов)

1. **F0, а не MIDI-нота** — непрерывная величина (261.7Hz, 264.1Hz...), именно она даёт «живую траекторию»: плавание, подъезд к ноте, vibrato, переходы. Наш PitchSample уже содержит frequency — совпадает.
2. **VAD-критичен:** «th/s/sh/k/дыхание не должны превращаться в случайные ноты» — не рисовать pitch там, где он не определён.
3. **Alignment — «один из самых важных вопросов»:** юзер может начать раньше/позже, петь медленнее/быстрее, микрофонная задержка ⇒ нельзя сравнивать reference[t] vs user[t] бездумно. Инструменты: timestamp/onset alignment, DTW/constrained DTW, phrase-level, TrackMap-aware, tolerance windows. Требование: «достаточно простой для realtime, но устойчивый».
4. **Deviation в центах** + сглаживание против джиттера (MA/median/exp/Kalman/hysteresis) — но не убить vibrato/portamento/атаку ноты.
5. **Confidence обязателен** у каждого измерения; низкий → не рисовать точку или состояние `uncertain`.
6. **Note states:** LOW / GOOD / HIGH / UNSTABLE / UNVOICED — «не превращать realtime-детектор в MIDI-клавиатуру», живая траектория прежде всего.
7. **НЕ караоке-тюнер:** не «C4 +17 cents LOW GOOD» — а audio monitoring / performance analysis, «пользователь видит музыкальное движение».
8. **Latency budget:** полный путь Mic→Worklet→F0→smoothing→alignment→UI; цель «визуальная реакция практически realtime». UI update ≠ audio rate; AudioWorklet → F0 stream → ring buffer → rAF → visual.
9. **React ≠ audio engine:** F0-поток живёт вне React; React получает уже готовое состояние (currentPitch/confidence/referenceF0/deviationCents/state) — сейчас у нас в PitchTab setMessage-per-frame в state хука — направление изменения.
10. **Data contract PitchFrame** (timestamp, f0, midi, cents, confidence, referenceF0, deviationCents, state) — «не считать окончательным», команда предложит лучший.
11. **Scoring = второй слой:** сначала безупречный детектор, потом accuracy/stability/timing/phrase (второй слой), vibrato/drift/scoops — исследовательский слой-3, НЕ расширять MVP.
12. **Reference offline:** допустим тяжёлый алгоритм (считается один раз при подготовке трека) — но это лифт каталога/порт-зона B09-стык.
13. **Принцип последовательности (жирно у проектировщика):** «Сначала стабильный raw pitch stream. Потом reference comparison. Потом scoring. И только потом AI Coach. Не наоборот.» Фундамент, ошибающийся на 50-100мс или скачущий F0, не спасёт никакой AI сверху.
14. **Искать КОМБИНАЦИИ**, не «лучшую либу»: Mic → F0 → Confidence → Alignment → Reference → Deviation → Smoothing → State → Visualization — вся цепочка, не одна технология.
15. **Context7 — обязательно** для API-верификации (Web Audio/AudioWorklet/WASM/ONNX Runtime Web/WebGPU/SharedArrayBuffer), не верить старым блогам при наличии официального док-источника.
16. **Формат отчёта:** таблица решений (Realtime/Accuracy/Latency/CPU/WASM/Browser/Singing/Verdict) → 3 архитектуры (A simplest-robust / B best-quality / C experimental-ML) → финальный вердикт «X+Y+Z, потому что...» + MVP / V2 / НЕ-ДЕЛАТЬ.

## 3. СВЕДЕНИЕ С НАШЕЙ РЕАЛЬНОСТЬЮ (голова agent-pitch, для прогонов)

| Блок GPT-механики | У нас сегодня | Дельта |
|---|---|---|
| F0 непрерывный | PitchSample.frequency (Hz) в ring-buffer | ✅ есть |
| VAD | RMS-gate 0.01 + SFM-шумометр (нет классификации консонанс/дыхание) | 🟡 частично |
| Confidence | YIN conf = 1−cmnd[te] | ✅ есть |
| Alignment reference[t] vs user[t] | НЕТ (матч = равенство строк «в моменте») | 🔴 главный пробел |
| Deviation cents | НЕТ (0 строк; коридор ±33/±50ц A-7 готов как вход) | 🔴 |
| Smoothing | median-5 + octLock (в детекторе) | ✅ частично |
| Note states | НЕТ (binary матч ✓) | 🔴 |
| React-разделение | setMessage-per-frame → setState в хуке PitchTab | 🟡 переделка |
| Ring buffer → rAF | ring 300 есть, читателя нет | ✅ сырьё есть |
| Reference offline JSON | НЕТ | 🔴 + стык B09 (лифт каталога) |
| Scoring | НЕТ (second layer по проектировщику) | слой-2, не MVP |
| AI Coach | Билли жив (не стыкован) | слой-4 по проектировщику |

**Вердикт головы:** GPT-механика НЕ отменяет направление 001 (стенд VIS-14 → детектор-агностичный слой) — она его **углубляет**: детектор-агностичность = именно PitchFrame-контракт; стенд решает качество F0-входа; alignment/состояния = новые фронт-вопросы для 001-ревизии после 002. Совпадает с принципом проектировщика: фундамент (raw stream) первым.

— **agent-pitch [B06] · 07.09 12:00 · механика проектировщика впитана, канон-рамка зоны 📘**
