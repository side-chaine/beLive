# MICRO-PACK-MARKER-SYNC · DRAFT (design-only) · 2026-08-25 · агент: Ф001 Со-Архитектор

**Основание:** team-m/MIGRATION-HOLES.md `markers-events.ts:39` (P1, стресс-коррекция #1 подтвердила P1: «маркерный рассинхрон» в итоговом P1=5) · `src/services/track.orchestrator.ts:357-436` (VOC L2/L3, FROZEN) · `js/audio-facade-v3.js:36-64` (awaitStemReady/getStemAudioBuffer — ПОДТВЕРЖДЕНО: уже проводены B-SLICE-VOC, см. team-m/MICRO-PACK-B-SLICE-VOC.md — ПАК 2 их ПОТРЕБЛЯЕТ, не дублирует). Соседний пак MICRO-PACK-TAKES-AUDIO-draft.md НЕ затрагивает markers/word-sync — конфликтов нет.
**Скоуп:** (А) устранение ≥500ms stale-окна предыдущего трека в markers-store; (Б) привязка marker-sync к VOC L2/L3-коррекции (dataVersion<4). Ноль правок кода — только дизайн.

**Ключевые находки (факт, уточнение holes-отчёта):**
- `markers-events.ts:37-40` слушает EventBus `track-loaded` и делает `setTimeout(syncMarkers, 500)`. `syncMarkers` (:19-35) читает `window.markerManager.markers` → пишет `useMarkersStore`. Между свитчем трека и 500мс store держит маркеры **ПРЕДЫДУЩЕГО** трека, а V3 уже auto-start (V3DataInterceptor:170 `transport.play`) → active-line/word-sync ≥500ms едут на чужих маркерах. 500мс — legacy-хак под V2 (mm не был населён в момент `track-loaded`); под v3 orchestrator УЖЕ вызвал `mm.setMarkers` ДО публикации (V3DataInterceptor:207 явно: «оркестратор:333 уже вызвал setMarkers ДО нас») — задержка теперь чисто вредна.
- VOC L2/L3 (`track.orchestrator.ts:357-436`, FROZEN) уже корректно ЗАГЕЙЧЕН на `ae.awaitStemReady?.('vocals',15000)` (:369) и `ae.getStemAudioBuffer?.('vocals')` (:375). Фасад `js/audio-facade-v3.js:44-64` эти методы УЖЕ предоставляет (B-SLICE-VOC провёл). Значит VOC под v3 **НЕ отключён** — holes-строка про «фасад без awaitStemReady» СТАЛА СТАЛОЙ. Реальный остаточный дефект: VOC мутирует `mm.setMarkers(correctedMarkers)` в runtime ТОЛЬКО если `playbackPosition < 5` (:383, `runtimeUpdate`) — а `markers-events` синкает store единожды в 500мс, ДО того как VOC дотянул vocals-стем и поправил mm → store получает НЕисправленные маркеры → dataVersion<4 едут со сдвигом до reload. Фикс: store должен ДОЖДАТЬСЯ VOC и ресинкнуться.

**Решение:** (А) на `track-loaded` — немедленно гасить stale-маркеры store + bounded settle-poll (ловит позднюю populate markers.bridge И VOC-runtime-коррекцию) + отмена предыдущего таймера (предотвращает перезапись новым треком старым свитчем); (Б) ресинк store ПОСЛЕ `ae.awaitStemReady('vocals')` resolves (момент завершения VOC) + defensive warn если метод отсутствует (НЕ молча).

---

## §1 Решения (file:line было → будет)

### 1.1 Stale-окно ≥500ms на маркерах предыдущего трека (`markers-events.ts:37-40`)

**Было:** `subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => { setTimeout(syncMarkers, 500) }))` — store держит старые маркеры 500мс; при быстром свитче предыдущий таймер НЕ отменяется → может перезаписать новый трек старыми.

**Будет:** `scheduleSyncForTrack(detail)`:
- `clearPending()` — отмена таймера предыдущего трека (сброс на loadTrack);
- `useMarkersStore.setState({ markers: [], sections: [], trackDuration: 0 })` — **немедленно** гасим stale-маркеры предыдущего трека (не ждём 500мс);
- bounded settle-poll: `syncMarkers()` сразу + `setInterval(settle, 120)` до стабилизации `useMarkersStore.markers` (ловит позднюю populate markers.bridge И VOC-runtime-correct) ИЛИ до таймаута 2000мс (`clearPending`).

*Почему не просто `syncMarkers()` сразу:* под v3 `mm` уже населён (orchestrator:333) — прямой синк возможен, НО VOC ещё не докорректировал mm (ждёт vocals-стем); settle-poll + §1.2 ловят итог.

### 1.2 Привязка marker-sync к VOC L2/L3 (`markers-events.ts:37-40` + потребление `track.orchestrator.ts:369` через фасад `js/audio-facade-v3.js:44-64`)

**Было:** store синкается ровно 1 раз в 500мс → VOC (runtime-correct, orchestrator:395/405/421 `mm.setMarkers`) происходит ПОСЛЕ → store навсегда держит неисправленные маркеры (dataVersion<4 сдвиг). `awaitStemReady` в фасаде есть, но НИКТО не ждёт его для ресинка store.

**Будет (в `scheduleSyncForTrack`):** после settle-poll добавить:
```ts
const ae = (window as any).audioEngine
if (typeof ae?.awaitStemReady === 'function') {
  ae.awaitStemReady('vocals', 15000).then(() => syncMarkers()).catch(() => {})
} else {
  console.warn('[MARKERS] ae.awaitStemReady отсутствует — VOC-коррекция не дождётся ресинка store (dataVersion<4 могут поехать)')
}
```
`awaitStemReady('vocals')` резолвится ровно когда vocals-стем декоден = момент, когда VOC (`track.orchestrator.ts:369`) уже отработал и поправил `mm` → финальный `syncMarkers()` кладёт ИСПРАВЛЕННЫЕ маркеры в store. Гейт на `awaitStemReady` = гейт VOC L2/L3 (оркестратор тем же методом ворочает), конфликтов с B-SLICE-VOC нет (мы только читаем, не правим фасад). `dataVersion:4` пишется в IDB (orchestrator:398/412/426) → на следующем лоаде needsL2/L3=false, сдвига нет вовсе.

### 1.3 `sections-updated` (`markers-events.ts:42-44`)

**Было:** `syncMarkers()` без сброса pending-таймера.

**Будет:** `clearPending(); syncMarkers()` — секции приходят после стабилизации, не сбивают активный poll.

---

## §2 Diff-набросок

### §2.1 `src/foundation/event-bus/wrappers/markers-events.ts` (полная замена initMarkersEvents)
```ts
export function initMarkersEvents(): () => void {
  const subs: Subscription[] = []
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setInterval> | null = null

  const clearPending = () => {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    if (settleTimer) { clearInterval(settleTimer); settleTimer = null }
  }

  const syncMarkers = () => {
    const mm = (window as any).markerManager
    if (mm?.markers) {
      const linesCount = useLyricsStore.getState().lines.length
      let validMarkers = mm.markers
      if (linesCount > 0) {
        validMarkers = mm.markers.filter((m: any) =>
          m.markerType === 'M2' || (m.lineIndex >= 0 && m.lineIndex < linesCount))
      }
      useMarkersStore.setState({
        markers: validMarkers,
        sections: mm.sections ? [...mm.sections] : [],
        trackDuration: mm.trackDuration || 0,
      })
    }
  }

  const scheduleSyncForTrack = (_detail?: any) => {
    clearPending()                                   // сброс таймеров ПРЕДЫДУЩЕГО трека
    // (А) немедленно гасим stale-маркеры предыдущего трека — не ждём 500мс
    useMarkersStore.setState({ markers: [], sections: [], trackDuration: 0 })
    // bounded settle-poll: ловим позднюю populate markers.bridge + VOC-runtime-correct
    let last = useMarkersStore.getState().markers
    const settle = () => {
      syncMarkers()
      const now = useMarkersStore.getState().markers
      if (now !== last) { last = now; return }       // ещё меняются — продолжаем
      clearPending()                                  // стабилизировалось
    }
    pendingTimer = setTimeout(() => { settle(); settleTimer = setInterval(settle, 120) }, 0)
    setTimeout(() => clearPending(), 2000)           // жёсткий предел poll
    // (Б) ресинк ПОСЛЕ VOC-коррекции (гейт = awaitStemReady, тот же что у оркестратора)
    const ae = (window as any).audioEngine
    if (typeof ae?.awaitStemReady === 'function') {
      ae.awaitStemReady('vocals', 15000).then(() => syncMarkers()).catch(() => {})
    } else {
      console.warn('[MARKERS] ae.awaitStemReady отсутствует — VOC-коррекция не дождётся ресинка store (dataVersion<4 могут поехать)')
    }
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (p) => scheduleSyncForTrack(p)))
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'sections-updated', () => { clearPending(); syncMarkers() }))

  return () => { clearPending(); subs.forEach(s => s.unsubscribe()) }
}
```

*Примечание по trackId:* `track-loaded` detail (V3DataInterceptor:210) НЕ несёт `trackId` → корреляция по trackId невозможна без правки FROZEN orchestrator. Механизм «clear + repopulate» robust и не требует trackId.

---

## §3 Тесты

Новый `src/foundation/event-bus/wrappers/__tests__/markers-events.test.ts` (vi.mock eventBus / window.markerManager / audioEngine):
1. `track-loaded → store.markers очищен СИНХРОННО (до 500мс)` — assert `useMarkersStore.getState().markers.length === 0` сразу после эмита (нет stale предыдущего трека).
2. `VOC-correct: ae.awaitStemReady резолвится → syncMarkers ресинкнул store с ИСПРАВЛЕННЫМИ маркерами` (замокать mm.markers до/после resolve).
3. `быстрый свитч: 2-й track-loaded до 500мс → clearPending отменил 1-й таймер; store НЕ перезаписан старым треком` (spy на syncMarkers: ровно N вызовов, финальный = новый трек).
4. `sections-updated → clearPending + syncMarkers (секции не сбивают активный poll)`.
5. `ae.awaitStemReady отсутствует → console.warn '[MARKERS] ...' вызван (НЕ молча); store всё равно populated из mm`.

Регресс: существующий `wrappers.smoke.test.ts` (track-loaded → active-line-changed) остаётся зелёным (поведение сохранено, лишь тайминг).

---

## §4 Risks + Frozen-check

| # | Риск | P | I | Митигация |
|---|---|---|---|---|
| R1 | settle-poll 120мс × до 2с даёт лишние syncMarkers (нагрузка на store/UI) | LOW | LOW | Poll гаснет при стабилизации markers (обычно 1-2 тика); hard-limit 2с. Дёшево (только setState при изменении) |
| R2 | `awaitStemReady('vocals')` таймаут 15с при треке БЕЗ vocals-стема → ресинк не придёт, но и VOC не нужен (orchestrator:369 тоже скипнет) | LOW | LOW | Симметрично с orchestrator; store уже populated из mm (uncorrected == correct, т.к. VOC не применим) |
| R3 | `now !== last` по ссылке: markers.bridge может делать НОВЫЙ массив each tick → poll не остановится до 2с | LOW | LOW | Hard-limit 2с гарантирует останов; 2с приемлемо. Опц. доработка: сравнение по length+markerType, вне скоупа |
| R4 | `clearPending` в sections-updated гасит активный VOC-resync через awaitStemReady (отдельный promise, НЕ в pendingTimer) | LOW | LOW | VOC-resync — отдельный `.then`, не затрагивается clearPending; секции приходят позже стабилизации, конфликта нет |

**Frozen-Zone — подтверждение: паком НЕ задевается.**
- `track.orchestrator.ts` (:357-436 VOC) — FROZEN, правок нет; ПАК 2 только ПОТРЕБЛЯЕТ его runtime-запись `mm.setMarkers` через ресинк store.
- `AudioEngineV2.ts`, `patchV1.ts`, `bridges/*` — не тронуты.
- `_-поля` не читаются.
- `js/audio-facade-v3.js` — НЕ правится (awaitStemReady/getStemAudioBuffer уже проведены B-SLICE-VOC; ПАК 2 только читает). Конфликт с B-slice исключён по построению.
- Все правки: ТОЛЬКО `src/foundation/event-bus/wrappers/markers-events.ts` + один тест-файл. Frozen-нарушений: 0.

---

## §5 Verify-чеклист (Near Light)

Автотест:
1. Канон: `tsc 313 / vitest passed 769+N, 0 новых ошибок, 0 новых skip`.
2. `markers-events.test.ts` зелёный (§3, кейсы 1-5); `wrappers.smoke.test.ts` без регресса.

Консоль/состояние (VITE_ENGINE=v3):
3. Свитч трека: `useMarkersStore.markers` очищается в тот же тик `track-loaded` → active-line/word-sync НЕ показывает чужой трек в первые 500мс (раньше гарантированно показывал).
4. `dataVersion<4` трек с vocals-стемом: после старта — маркеры в store ИСПРАВЛЕНЫ (offset применён), НЕ сдвинуты; IDB `dataVersion` становится 4 (orchestrator:398/412/426) → следующий лоад без VOC.
5. Быстрый свитч (2 track-loaded < 500мс): stale-маркеры предыдущего трека НЕ всплывают (clearPending).
6. Фасад без awaitStemReady (искусственно убрать): warn `[MARKERS] ...` в консоли, НЕ молча.

Ретест ушами (план §5 mic-сессия): marker/word-sync ретесты НЕ конфликтуют; проверить, что solo-превью/vocal-fade (TAKES-AUDIO) не задевают markers-store (не задевают — разные сторы).

---

*Статус: DRAFT, design-only, код не менялся, коммит не выполнялся.*
