# ЧЕК-ЛИСТ · Локальная проверка SPLIT (Windows + BT) · батч-1

> Для Никиты. Dev-сервер: `npm run dev` → `http://localhost:3000/beLive/`. Полный протокол: отчёт 005-B в истории прогона.

## 0. Предусловия
- [ ] Windows «Звук → По умолчанию» = **БТ-гарнитура** (иначе R1-фленджер спутает картину)
- [ ] Chrome, консоль открыта (F12), Preserve log ON
- [ ] Клик 🎤 в ControlDeck (разрешение на мик → метки устройств читаемы)
- [ ] Дождаться в консоли `V3 loadTrack completed` (иначе панель ведёт легаси — тест недействителен)

## 1. Быстрые проверки в консоли
```js
// Устройства видны? (должны быть БТ + колонки ПК с метками)
await navigator.mediaDevices.enumerateDevices().then(ds => ds.filter(d=>d.kind==='audiooutput').map(d=>({id:d.deviceId.slice(0,8), label:d.label||'(ПУСТО)'})))
// setSinkId поддерживается? (должно быть true)
'setSinkId' in HTMLMediaElement.prototype
// Скрытые плееры (до SPLIT: 0-2)
document.querySelectorAll('audio').length
```

## 2. Сценарий SPLIT (главный)
1. Вкладка Split → 🎧 = **БТ-гарнитура** → Send music to = **колонки ПК** (НЕ «System speakers»!)
2. В консоли — **НОЛЬ** ошибок `srcObject` (было ~15 до фикса)
3. Клик **SPLIT** → в консоли `[DeviceManager] monitor audio PLAYING` + `[DeviceManager] main audio PLAYING`
4. `document.querySelectorAll('audio').length` → **ровно +2** к baseline
5. **Уши (БТ):** мик-самоконтроль (скажи «раз-раз») + тихая музыка-референс
6. **Зал (колонки):** музыка + вокал, громко
7. Фленджер/эхо? Если да — проверь: `Send music to` точно НЕ «System speakers»? (R1: `''` = тот же БТ → удвоение, это настройка, не баг)

## 3. STOP и повтор
- [ ] STOP → зал тихий; в ушах остались программа + мик (это НОРМА: STOP = возврат в системный выход, не тишина)
- [ ] F5 → SPLIT снова → устройства подхватились сами (restore sinkId работает)

## 4. Что прислать голове
- Скрин консоли (или текст): есть ли `PLAYING`-строки, есть ли ошибки
- `document.querySelectorAll('audio').length` до/после
- Таблица: зал слышит? / уши мик? / уши музыка? / фленджер?
- `enumerateDevices()` выхлоп (deviceId обрежь до 8 символов — приватность)
- deviceId БТ до/после перезагрузки страницы — совпал? (открытый вопрос прогона)

— agent-split [B04] · чек-лист батча-1 🎧
