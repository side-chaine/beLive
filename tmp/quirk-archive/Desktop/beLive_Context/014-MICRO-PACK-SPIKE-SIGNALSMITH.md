# 📦 MICRO-PACK: Spike — Signalsmith Reality Check

**Номер:** 014
**Дата:** 2026-07-24
**Автор:** 007_1.9
**Для:** Оператор + новый архитектор (GPT/Sonnet)
**Тип:** SPIKE (изолированный эксперимент, не миграция)
**Статус:** 🟡 К выполнению

---

## ЦЕЛЬ

Проверить, пригоден ли `signalsmith-stretch` для real-time time-stretch/pitch-shift в архитектуре beLive, **не трогая production код**.

6 вопросов, на которые должен ответить Spike:

| # | Вопрос | Критерий GO |
|:-:|:-------|:------------|
| 1 | Можно ли непрерывно воспроизводить поток в AudioWorklet? | Без глитчей >30с |
| 2 | Работает ли изменение rate 0.5×–1.5× без pitch drift? | На слух чисто, rate<1.0 без "gate" |
| 3 | Работают ли loop без щелчков? | `loopStart/loopEnd` без артефактов |
| 4 | Не ломается ли seek? | `schedule({ input })` плавно, без тишины |
| 5 | Реальный CPU на 2013 MBP? | < 10% (cheaper preset, post-mix) |
| 6 | Задержка (latency)? | < 50ms (cheaper preset) |

**Если 5/6 GO → Фаза 1 (Адаптер). Если нет → остаёмся на varispeed-only.**

---

## ФАЙЛЫ

### Нужно создать

| Файл | Назначение |
|:-----|:-----------|
| `signalsmith-spike/package.json` | Изолированный тестовый проект (или прямо в beLive spike-ветке) |
| `signalsmith-spike/index.html` | Тестовая страница: кнопки play/pause/loop/seek + rate slider |
| `signalsmith-spike/test.ts` | Скрипт: грузит реальный .mp3/.wav, подключает Signalsmith, меняет rate |

### Нужно установить

```
npm install signalsmith-stretch
```

### Production файлы (НЕ ТРОГАТЬ)

```
❌ src/audio/engine-v3/           — не трогать
❌ src/audio/core/AudioEngineV2   — frozen ❄️
❌ package.json                   — не добавлять signalsmith-stretch сюда (пока)
```

---

## ДЕЙСТВИЕ

### Шаг 1: Подготовка

```bash
git checkout -b signalsmith-spike
cd signalsmith-spike  # или создай папку в корне проекта
npm init -y
npm install signalsmith-stretch
```

### Шаг 2: Тестовая страница

Создай `index.html` с:

```html
<!-- Кнопки: ▶️ Play | ⏸ Pause | 🔄 Loop | ⏩ Seek | 🎚 Rate slider 0.5–1.5 -->
<!-- Таймер: currentTime, CPU (performance.now()), latency -->
```

И `test.ts`:

```typescript
import SignalsmithStretch from 'signalsmith-stretch'

async function main() {
  const ctx = new AudioContext()
  
  // 1. Загружаем реальный трек (с транзиентами — ударные, вокал)
  const response = await fetch('/test-track.mp3')
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  // 2. Source играет на normal speed
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = 1.0

  // 3. Signalsmith post-mix
  const stretch = await SignalsmithStretch(ctx, { outputChannelCount: [2] })
  await stretch.configure({ preset: 'cheaper', splitComputation: true })
  
  // 4. Wire: source → stretch → destination
  source.connect(stretch)
  stretch.connect(ctx.destination)

  // 5. Schedule: rate = 0.85 (замедление с сохранением питча)
  stretch.schedule({ active: true, rate: 0.85, semitones: 0 })

  // 6. UI sync (10 fps)
  stretch.setUpdateInterval(0.1, (time) => {
    console.log(`inputTime: ${time.toFixed(2)}s`)
  })

  // 7. Start
  source.start()
  console.log(`Latency: ${(await stretch.latency() * 1000).toFixed(1)}ms`)
}
```

### Шаг 3: Проверки

| Проверка | Команда | Критерий |
|:---------|:--------|:---------|
| **Play >30с** | play rate=0.85 | Нет глитчей, нет "gate" |
| **Rate sweep** | 0.5 → 1.0 → 1.5 | Питч не дрифтует |
| **Loop** | `schedule({ loopStart: 5, loopEnd: 10 })` | Нет щелчков на границе |
| **Seek** | `schedule({ input: 20 })` | Плавно, без тишины |
| **CPU** | Chrome DevTools > Performance > CPU | < 10% |
| **Latency** | `stretch.latency()` | < 50ms |

### Шаг 4: Результат

Остановись и запиши наблюдения в `SPIKE-RESULTS.md`:

```markdown
# SPIKE RESULTS: Signalsmith Reality Check

**Дата:** 2026-07-24
**Машина:** MacBook Pro 2013 (i7-4558U, 16GB, Monterey 12.7.4)
**Браузер:** Chrome/Firefox/Safari — какой тестировал

## Результаты

| Вопрос | Статус | Заметки |
|:-------|:------:|:--------|
| 1. Поток >30с | ✅/❌ | ... |
| 2. Rate без drift | ✅/❌ | ... |
| 3. Loop без щелчков | ✅/❌ | ... |
| 4. Seek плавный | ✅/❌ | ... |
| 5. CPU < 10% | ✅/❌ | ... |
| 6. Latency < 50ms | ✅/❌ | ... |

## Вердикт
GO / NO GO
```

---

## КОНТЕКСТ

```typescript
// Три строчки до — как выглядит инициализация AudioContext в beLive
const ctx = new AudioContext()
// AudioBufferSourceNode играет на нормальной скорости
source.playbackRate.value = 1.0

// Три строчки после — как Signalsmith встраивается
const stretch = await SignalsmithStretch(ctx, { outputChannelCount: [2] })
stretch.connect(ctx.destination)
source.connect(stretch)
```

---

## ЗАПРЕЩЕНО

| Действие | Почему |
|:---------|:-------|
| ❌ Менять `src/audio/engine-v3/` | Production код. Миграция только после GO |
| ❌ Менять `package.json` в корне | Добавлять signalsmith-stretch только после решения |
| ❌ Трогать frozen-зоны | AudioEngineV2, patchV1, bridges, track.orchestrator |
| ❌ Удалять SoundTouch-файлы | Удалим только после GO и Фазы 1 |
| ❌ Использовать синтетический сигнал (синусоида) | SoundTouch на синтетике выглядел чисто, а на реальном треке сломался. **Только реальный трек с транзиентами** |

---

## ТЕСТ

```bash
# Проверка: установлен ли пакет
npm ls signalsmith-stretch

# Проверка: импорт работает
node -e "const s = require('signalsmith-stretch'); console.log('OK', Object.keys(s))"

# Проверка: production код не затронут
git diff --stat src/
# Должно быть: 0 изменений (все изменения только в signalsmith-spike/ папке)
```

---

## ПОСЛЕ SPIKE

| Результат | Что дальше |
|:---------:|:-----------|
| ✅ GO | Возвращаемся сюда. Создаём `SignalsmithAdapterService.ts`, подключаем post-mix. Фаза 1 |
| ❌ NO GO | Закрываем тред. Остаёмся на varispeed-only. Удаляем SoundTouch-файлы как мусор |
