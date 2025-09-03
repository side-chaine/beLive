## Pitch — правила стабильной работы (dev/prod)

Краткий чек‑лист, чтобы Pitch всегда отображал шарик и активные ноты после любых правок.

### 1) Как запускать приложение локально
- HTTP (предпочтительно, стабильно в Chrome):
```bash
cd "/Users/sidechaine/Documents/beLive" && npx --yes http-server -c-1 . --port 8080 --cors --silent
# затем открыть: http://localhost:8080/index.html
```
- file:// (разрешить доступ к файлам в Chrome, если нужен прямой запуск HTML):
```bash
open -na "Google Chrome" --args --allow-file-access-from-files --autoplay-policy=no-user-gesture-required file:///Users/sidechaine/Documents/beLive/index.html
```

### 2) Обязательные инварианты в коде
- В `js/piano-keyboard.js::setupAudioContext()` НЕЛЬЗЯ удалять «тихий» выход анализатора:
  - `this.analyser → this._silentMonitorGain(gain=0.0) → audioContext.destination`
  - Это держит ветку WebAudio «живой» в Chrome (без него анализ может «молчать»).
- В `startBackgroundVocalAnalysis()` оставляем порядок подключения узлов и RMS‑проверку:
  - Для HTTP: `vocalsSourceNode → vocalsGain → masterGain → outputGain`
  - Для file:// (Chrome): `masterGain → outputGain → vocalsGain → vocalsSourceNode`
  - После каждого подключения делаем быстрый RMS‑замер; если тишина — пробуем следующий узел.
- Фолбэк на микрофон НЕ удалять: если ко всем узлам не удалось подключиться, подключаем `getUserMedia(...)` к `analyser`.
- В `show()` НЕ ставить авто‑сон: вызываем `_clearAutoOff()` (а не `_armAutoOff()`), чтобы UI не закрывался сам.

### 3) Загрузка Pitchy
- `waitForPitchy()` содержит CDN‑фолбэки (jsDelivr → unpkg). Не убирать.
- При таймауте CDN — шарик не появится. Проверить сеть и дождаться `✅ Pitchy детектор готов...` в логах.

### 4) Быстрая диагностика (в Console)
Вставить и прислать вывод, если шарика нет:
```javascript
console.log('CTX', audioEngine?.audioContext?.state);
console.log('NODES', {src:!!audioEngine?.vocalsSourceNode, gain:!!audioEngine?.vocalsGain, master:!!audioEngine?.masterGain, out:!!audioEngine?.outputGain});
console.log('PK', {active: pianoKeyboard?.isActive, analyzing: pianoKeyboard?.isBackgroundAnalyzing, fft: pianoKeyboard?.analyser?.fftSize});
(()=>{const a=pianoKeyboard?.analyser;if(!a){return console.log('no analyser');}
const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);let s=0,min=1,max=-1;for(const v of b){s+=v*v;if(v<min)min=v;if(v>max)max=v;}const rms=Math.sqrt(s/b.length);
console.log('RMS',rms.toFixed(6),'min',min.toFixed(3),'max',max.toFixed(3));})();
```
Ожидания: `RMS > 0.0005` и в логах `✅ Подключен к ВОКАЛЬНОМУ узлу` либо `✅ Подключен к микрофону`.

### 5) Типичные симптомы и быстрые решения
- «Пустая клавиатура» в Chrome при file:// → запуск через HTTP или Chrome с флагом из п.1; проверить, что остался «тихий» выход и включён фолбэк на микрофон.
- CDN Pitchy упал/таймаут → перезагрузить с кэшем off (Cmd+Shift+R) или проверить сеть.
- Вокал на нуле, шарик есть → это норма: анализ идёт префейдером (через `vocalsSourceNode/voxGain`).

### 6) Мини‑чек перед релизом
- Открыть в Rehearsal и Concert: шарик и подсветка клавиш есть.
- В Karaoke: кнопка Pitch неактивна.
- Авто‑закрытия UI нет, пока он открыт; в фоне авто‑сон не шумит.

### 7) Очистка окружения (по необходимости)
- Жёсткое обновление: Cmd+Shift+R
- Очистка IndexedDB (если нужно): Application → IndexedDB → удалить `TextAppDB_*`

Документ обновлять при каждом изменении `js/piano-keyboard.js` или аудио‑движка.


