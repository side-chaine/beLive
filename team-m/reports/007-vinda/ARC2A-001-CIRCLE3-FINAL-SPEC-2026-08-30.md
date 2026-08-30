# ARC-2a · Круг-3 · 001 «Ювелир» — ФИНАЛЬНЫЙ СПЕКА-ПАК (ответ на Круг-2, вердикт Operator'у)

**БАЗА:** HEAD `d99609a` · 30.08.2026 · вход: tsc=296 🔴 (4×TS2339 VIS-19: 3×`get` + 1×`init`) · vitest=761+0int+0load 🟢 (63 файла) · PARITY 🟢 · V3=дефолт
**Все факты Круга-2 перепроверены grep/чтением 001 (PitchModule self-imports only; `pianoKeyboard =` 0 присвоений; poison-путь engine.ts:101-106; V2Adapter.getInstance :19-23; deck/modules.ts:96-102 — только PitchTab).**

---

## ОТВЕТЫ НА УДАРЫ 002 (1-5: принял/опроверг/уточнил + что войдёт в спеку):

**УДАР 1 — ПРИНЯЮ.** Мок `initFromMic` действительно не исполняет реальный poison-путь (`_status='error'` → `destroy()` → `idle`, engine.ts:101-106); мой кейс-2 проверял store-обвязку повтора, а не выживание singleton'а. Принято: +1 безмоковый кейс в ТОТ ЖЕ файл (кейс-4 ниже). X тестов: 3→4.

**УДАР 2 — ПРИНЯЮ.** Прогноз 292 без инварианта = подгон чисел вместо разбора. Принято: tsc==292 — инвариант ПОСЛЕ обеих правок (фикс + тест-файл), тест-файл strict-чист (noUnusedLocals/noUnusedParameters — на ревью до Operator'а), любое ≠292 = СТОП (уточнение к 002: стоп и при <292 — «лишние» −1 означают несанкционированные правки вне спеки).

**УДАР 3 — ПРИНЯЮ, признаю промах Круга-1.** Grep подтверждает: PitchModule.tsx не импортируется нигде (только self-references :97/:165), deck/modules.ts:96-102 регистрирует исключительно PitchTab, `window.pianoKeyboard` нигде не присваивается → bridge = вечный noop по destination. Моя фраза «это и есть улучшение» — пере-обещание. Формулировка канона меняется: **ARC-2a = tsc-зелёный + контракт для ARC-2e, НЕ UX-фикс.** «Честный error-текст» (`audioEngine.audioContext not found`) до ARC-2e видят только тесты/консоль. Скаут-лейбл «PitchModule:104 — ЖИВОЙ UI-путь» тоже мёртв — помечаем в памяти прогона.

**УДАР 4 — ПРИНЯЮ полностью (обе части).** (а) Двойная истина singleton/new реальна как мина ARC-2e: PitchTab-cleanup `destroy()` (:319) убьёт singleton под живым store. → JSDoc-сторож на `static get()`. Усиление: `this._listeners.clear()` в destroy(): делает инвариант порядка `_unsub→destroy` самозащищённым; для PitchTab-инстансов безопасно (их unsub-ремоверы уже отработали до destroy). Под-удар (б) 002 вычеркнул сам — согласен, подписка идёт после `await initFromMic()` (store:49→51), порождения нет.

**УДАР 5 — ПРИНЯЮ (снятый, комментарий).** Обе ветки умирают в `_getContext()` (engine.ts:49) ДО захвата стрима в V3 — двойного getUserMedia сегодня не существует. Комментарий-сторож 1 строкой в store:49, код не трогаем.

---

## ФИНАЛЬНАЯ СПЕКА (файл:строка, старое→новое, по пунктам; порядок исполнения = порядок нумерации):

**P1. `src/audio/pitch/pitch-engine.ts` — вставка после строки 20 (`export class PitchEngine {`), перед `readonly ring...` (строка 21):**
```
  /**
   * Singleton accessor. Владелец singleton-а — pitch.store/bridge (ARC-2a).
   * PitchTab владеет ЛОКАЛЬНЫМИ инстансами (new) до ARC-2e.
   * ⚠ МИНА ARC-2e: перевод PitchTab на get() требует события смерти/пересборки store —
   * PitchTab-cleanup destroy() убьёт singleton под живым store (status:'running' без worklet).
   */
  private static _instance: PitchEngine | null = null;
  static get(): PitchEngine {
    if (!PitchEngine._instance) PitchEngine._instance = new PitchEngine();
    return PitchEngine._instance;
  }
```
9 строк (4 JSDoc + 5 кода), 0 логики в JSDoc. Имя `get()` НЕ переименовывать в getInstance (канон 002: 3 сайта уже написаны, V2Adapter-паттерн подтверждает каноничность формы).

**P2. `src/audio/pitch/pitch-engine.ts` — вставка после строки 238 (`this._ownStream = false;`), перед `this.ring.clear();` (строка 240):**
```
    this._listeners.clear();
```
1 строка внутри destroy(). Эффект: зомби-подписки невозможны в принципе; порядок `_unsub→destroy` в stopPitch получает самозащиту (для PitchTab-инстансов — no-op: их unsub-ремоверы отработали в cleanup эффекта ДО destroy).

**P3. `src/stores/pitch.store.ts:49` — замена:**
- старое: `      await engine.init();`
- новое: `      await engine.initFromMic(); /* mic-only до ARC-2e; риск двойного захвата с PitchTab-mic в V2 — разрулить в ARC-2e */`

**P4. Новый файл `src/stores/__tests__/pitch-store.test.ts` (единственный новый файл, 63→64).**

Обязательная обвязка (анти-flakiness, без интерпретаций):
- `beforeEach(() => { PitchEngine.get().destroy(); usePitchStore.setState({ status: 'idle', error: null, frequency: null, note: null, midi: null, cents: 0, confidence: 0, isSinging: false }); });` — статика singleton'а живёт между кейсами, сброс обязателен.
- ЗАПРЕТ: не ассертить данные колбэка подписки напрямую (модульный `_lastUpdate`/THROTTLE_MS=100 неэкспортирован и молча съест второй колбэк). Ассерты — только на `status`/`error`/порядок вызовов.
- Файл strict-чист: 0 неиспользуемых переменных/параметров (noUnusedLocals/noUnusedParameters).

Кейсы (ровно 4 `it()`):
- **кейс-1 «happy-path + guard»:** `vi.spyOn(PitchEngine.prototype, 'initFromMic').mockResolvedValue(undefined)`; `subscribe` мок → возвращает spy-remover. Действия: `startPitch()`. Ассерты: `status === 'running'`; повторный `startPitch()` при running → guard no-op, `initFromMic` вызван ровно 1 раз.
- **кейс-2 «V3-бросок (мок) + повтор»:** `vi.spyOn(... 'initFromMic').mockRejectedValue(new Error('audioEngine.audioContext not found'))`. Действия: `startPitch()` (catch). Ассерты: `status === 'error'`, `error === 'audioEngine.audioContext not found'` (контракт текста до ARC-2d); повторный `startPitch()` → `initFromMic` вызван снова (count ≥ 2) — store-уровень неотравляемости.
- **кейс-3 «stopPitch порядок»:** моки как в кейс-1; собрать `calls: string[]`; spy-remover пушит `'unsub'`; `vi.spyOn(PitchEngine.prototype, 'destroy')` (impl: real, push `'destroy'`). Действия: `startPitch()` → `stopPitch()`. Ассерт: `calls` строго `['unsub', 'destroy']` (инвариант порядка, P2 его страхует, но не заменяет).
- **кейс-4 «poison-путь БЕЗ моков (стресс, главный для β)»:** НОЛЬ spy-моков на engine. Окружение jsdom: `window.audioEngine` undefined → реальный `initFromMic()` бросает в `_getContext()` (engine.ts:49). Действия: `await expect(startPitch()).rejects.toThrow('audioEngine.audioContext not found')`. Ассерты: store `status === 'error'`, `error === 'audioEngine.audioContext not found'`; **`PitchEngine.get().status === 'idle'`** (poison-путь :102→:104 отработал, singleton не отравлен); повторный вызов — снова честно rejects (не молчит-void, не зависает в 'starting').

**P5. После P1-P4 (в этом порядке):** `tsc` → 292; `vitest run` → 765+0int+0load, 64 файла. Числа — см. инвариант ниже, НЕ подгонять.

Точки БЕЗ правок (канон, не трогать): `pitch.store.ts:45` (`PitchEngine.get()`), `pitch.store.ts:85` (`.destroy()`), `pitch-visual-bridge.ts:17`, порядок `stopPitch` :80-85. Frozen (`AudioEngineV2.ts`, `patchV1.ts`, `src/bridges/*`, `track.orchestrator.ts`) — не затронуты ни одной правкой.

---

## КАНОН-ИНВАРИАНТ (числа + СТОП-условия для Operator'а):

- **tsc == 292** (296 − 4: TS2339 ×3 `get` [store:45, store:85, bridge:17] + ×1 `init` [store:49]) — **после ОБЕИХ правок** (P1-P3 + P4-тест-файл). Дифф строго −4, все 4 — VIS-19 TS2339. **Любое ≠292 (293+ ИЛИ <292) = СТОП Operator'а и разбор источника** — подгон канона запрещён.
- **vitest == 765+0int+0load** (761 + 4 новых кейса), 0 failed, 0 skipped, файлы тестов **63 → 64**. Любое иное число тестов/файлов = разбор, не приём.
- **Условие достижения:** P4 strict-чист (проверяется ревью ДО передачи Operator'у); дифф-план = P1-P4 и ничто более; порядок исполнения P1→P4.
- **STOP-условия:** tsc ≠ 292; vitest ≠ 765+0int+0load; ≠64 файла; любой кейс-4-ассерт красный (`status` застрял не в 'idle'); появление диффа в frozen или в точках «без правок»; несанкционированные правки вне 3 файлов спеки.

---

## РАМКА ДЛЯ 009 (что проверять):

1. **Инварианты β:** `PitchEngine.get()` — тот же экземпляр на повторных вызовах; store:45/store:85/bridge:17 — ноль правок; `new PitchEngine()` в PitchTab:252/:307 работает параллельно (двойная истина сохранена, сторож = JSDoc P1).
2. **Poison-путь (главное):** кейс-4 зелёный на реальном коде: throw :49 → `_status='error'` :102 → `destroy()` :104 → `_status='idle'` :241 → throw наружу :105; store = 'error'; повторный вызов снова бросает.
3. **Порядок `_unsub → _bridgeCleanup → destroy`** (store:80-85, ноль правок): кейс-3 зелёный; P2 `_listeners.clear()` в destroy() — самозащита инварианта, НЕ замена порядка.
4. **tsc-дифф строго −4, все VIS-19 TS2339**, итог 292; vitest 765+0int+0load, 64 файла; 0 диффа в frozen; P4 strict-чист (noUnusedLocals/noUnusedParameters).
5. **Рамка эффекта (из Удара-3):** ARC-2a = tsc-зелёный + контракт ARC-2e, живого UX-эффекта НЕТ (PitchModule не смонтирован, bridge-destination мёртв) — ложный баг-репорт «питч не работает» в ARC-2e недопустим как претензия к ARC-2a.

## Расхождения с 002 (если остались):

- По существу — 0. Два уточнения-усиления: (1) vitest-таргет зафиксирован жёстко **765+0int+0load** (у 002 «764 минимум / 765 рекомендовано» — с 4 кейсами в спеке дрейф закрыт); (2) tsc-СТОП расширен на **любое ≠292**, включая <292 (у 002 только 293+) — меньшее число = правки вне спеки, тоже разбор.

---
*001 · Ювелир · Круг-3 FINAL · Дифф: 9 строк (P1, из них 4 JSDoc) + 1 строка (P2) + 1 строка (P3) + 1 тест-файл (P4). Frozen не тронут. β канонична, не переименовывать. Готово к Operator'у.*
