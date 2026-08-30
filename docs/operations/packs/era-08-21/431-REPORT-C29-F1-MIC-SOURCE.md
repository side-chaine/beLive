# 431-REPORT — C29: F-1 ПРИМЕНЁН (запись починена кодом) · А1/А2/А4 · GUARD-атрибуция

**Коммит:** C29 = `3fe2620` · ветка V3-finish_2 · frozen не тронут (git status чист по зоне).

---

## 1. C29 — F-1 MIC-SOURCE-V3: применён, верифицирован дважды

**Оператор:** 6/6 EDIT дословно, все анкоры найдены, отклонений 0.
**Верификация 007 (независимый прогон):** tsc **314** (MicSourceV3.ts и takes.recorder.ts — 0 ошибок; в тронутых файлах только предсуществующие TS6133/TS6192 со сдвигом строк) · vitest **749 passed / 2 failed / 751 total** (2 legacy collection-error, см. А4).

**Состав (архрешения Ц3 соблюдены):**
- **D1 (acquisition ≠ pipeline):** новый `engine-v3/services/MicSourceV3.ts` — мик-стрим ВЫШЕ плейбек-DSP; refcounted `acquire()/release()`, dispose-tracks при refCount=0; R9 `{EC:false, NS:false, AGC:false}`; parity C11: ключ `mic:deviceId`, exact-constraint + auto-fallback на дефолт; таксономия ошибок `permission-denied | no-device | stream-fail`.
- **D2 (зона №2):** `core/MicrophoneManager` НЕ импортирован и НЕ изменён — parity только по ключу localStorage.
- HPS: `+get ctx()` (публичный AudioContext для тапов; понадобится F-2).
- main.tsx: `__belive.micSource` (с `??` guard от повторного бута).
- takes.recorder: v3-ветка acquisition + `lastError` + `release()` в cleanupNodes (владение стримом возвращается источнику).
- TakesControlStrip: **оба немых гейта сняты** (сайт 1 = видимый REC; сайт 2 = СЦЕНАРНЫЙ FIRST WINDOW BRANCH — вот почему «сценарии не работали»: тот же тихий return); после `start()` — проверка lastError → бейдж + abort ДО pre-roll/playback.
- MixerPanel: mic-select разблокирован в v3, value из localStorage, onChange → `micSource.setDevice`.
- Бейдж у REC-кластера: «Доступ запрещён / Микрофон не найден / Движок инициализируется / Недоступен». Обещанный кодом «тост/бейдж» стал правдой — как error-path настоящей фичи (формулировка Ц3).

## 2. А1/А2/А4 — полстраницы (хвост Ц3, второе напоминание)

### А1 (busVol в формуле) — ЗАКРЫТ ФАКТОМ; сходится с независимым ответом Sonnet
- `_busAGain` существует: HPS :34, создание :95–96 (`gain.value = 1.0`, коммент «Stretch always active»), граф :101–102: `chainA.outputNode → _busAGain → _outputGain`. chainA.outputNode стоит после merge всей цепи (stems→mergeGain→muteGain→[delay BusB]→outputGain) ⇒ `_busAGain` = ПОСЛЕ суммы стемов, ПЕРЕД финальным мастером — ровно как сформулировал Sonnet.
- Статичен: 1.0 в конструкторе; rebuild :251 снова 1.0; читается RouteCheck :407. Пользовательского множителя НЕТ: `_busBGain`=0.0 dead (:97–98, «будет удалён в 067-D»), `busVolumes` в сторе/sync — 0 вхождений.
- Эквивалентность: V2 = raw×busVol внутри per-stem effectiveGain; V3 = per-stem effectiveGain (raw×маска) + статический `_busAGain`=1.0 ниже по графу. При 1.0 тождественно совпадают. Точка расширения на будущее (если шинные множители понадобятся): либо узел `_busAGain`, либо член в `_effectiveGainOf` — решение Ц3 при появлении требования.

### А2 (двойное применение в chainA) — ПОДТВЕРЖДЕНО КОДОМ; benign-same-tick, не живой баг
- Единственный writer в установившемся режиме: `_applyEffectiveGain` HPS :557–563 (ramp stretchGain + `stem.volume` = faderGain, сеттер StemPlayerV3 :91–93).
- `chainA.muteStem` :74 / `chainA.setStemVolume` :80 — мёртвый API: 0 вызовов извне (grep: все `.setStemVolume(`/`.muteStem(` — store или pipeline).
- НО `pipeline.soloStem` :490–494 зовёт `_chainA.soloStem` :86, который кроме мутации маски дёргает легаси `_applySolo()` :95–103 — СТОМПИТ `stem.volume=0/1` всем стемам цепи (при снятии solo — ВСЕМ в 1!). Следом тот же тик цикл :493 пересчитывает всё через `_applyEffectiveGain`. Финал всегда корректен.
- Теоретическое окно: JS-запись faderGain и снапшот параметра рендер-потоком не синхронизированы — один квант (~2.7мс) может снять промежуточное значение (blip при unsolo-all). На слух необнаружимо, на бумаге нарушает single-writer.
- **Предложение (3 строки, ждёт одобрения Ц3):** из `StemChain.soloStem` убрать вызов `_applySolo()` (оставить только мутацию `_soloed`), сам `_applySolo` удалить — других вызовов нет (grep подтверждает: единственный call-site :92).

### А4 (единая формулировка верификации) — КАНОН НАВСЕГДА
`tsc --noEmit`: **314** (база C13); diff error sets vs HEAD — IDENTICAL на каждом коммите (метод: git worktree HEAD, сравнение файл+код+текст без номеров строк).
`vitest run`: **749 passed / 2 failed / 751 total**. Два failed — `src/legacy/engine-v3/__tests__/engine-v3.test.ts` + `vocal-mic.test.ts`, collection-error на импорте (`../MeterNodeV3`, `./V2Adapter`), предсуществующие (stash-подтверждено), `src/legacy` паками не затрагивается. Ранние «749/749» — та же база до учёта legacy-файлов; канон отныне — тройка **749/2/751**.

## 3. GUARD «36 markers out of bounds» — атрибуция чтением кода
- v3-логика (`lyrics-events.ts:47–77`): маркер невалиден при `lineIndex < 0 || ≥ lines.length`; >5 → CRITICAL once (`_guardLogged`).
- **Идентичный гард в V2:** `src/bridges/lyrics.bridge.ts:101–126` — тот же invalidCount, порог >5, тот же текст; v3-файл прямо комментирован «Портировано из bridge.ts:90-132».
- Данные markers/lines грузятся апстримом выбора движка ⇒ по построению воспроизведётся и в v2. Живая перепроверка (1 мин, пользователь): трек B `1787200209918` в v2-конфиге — ожидаю тот же CRITICAL.
- Классификация по рамке Ц3: **пре-существующая дата-проблема трека B** (36 маркеров с lineIndex вне текста лирики) → M5-prep/data-backlog + строка DOC-CHECK. M3 не блокирует.

## 4. Принято к протоколу
- E1-инвентарь **+1**: гейт `t3.state !== 'idle'` (корень застревания C28) — сайт семейства предикатов, шаблон (iv).
- M2-latency → телеметрия, не гейт; бейзлайн ≥10 точек, обе конфигурации, ledger #3 — копим.
- RTL §H + П-8 №1 → реестр. П-8 №2 → mic-уши-сессия (запись = честная нагрузка).

## 5. Карта
```
✅ F-1 (C29=3fe2620)
→ [рекомендация 007: 3-мин смоук записи пользователем — защита инвестиции перед F-2]
→ F-2: монитор-маршрут stream→router.micInput, первый setMicEnabled, самомониторинг;
       ⛔ ГЕЙТ G14: проводной — БЕЗ дефолтного _micDelay 120мс; реестр-дельта F5 обязательна
→ mic-уши-сессия: запись+волна+сценарий+самомонитор+RTL §E/H+П-8№2+TRIM-BASIS full
∥ E4-A + секция F → E2 (после F-2)
ПОСЛЕ: полный 425 (+G4-инвариант raw-знаменателя) → Ц3+Ц2 → сборка M3-GO
```
Открытые микро-вопросы к Ц3: (i) одобрение 3-строчного cleanup `_applySolo` (А2); (ii) нужна ли canvas-заглушка волны или бейдж достаточен.