# СПЕКА MICRO-PACK «№18-BUS + FADER» · v3.1 FINAL · от 006 · 22.08 · 📌DC3: правки 009 внесены дословно (fix#1 тест TC-005, fix#2 гард !__v3 на ae-вызов, fix#3 whitelist :195; INFO страховка cold-start)
**Статус:** план v3, заменяет FINAL v2 из CHAIN-REPORT №18-BUS. Включает: 5 правок верификации 009 + GO юзера на красный фейдер (Inst→music-bus). После DOC-CHECK 009 → 007 номерует и dispatch'ит Оператора.
**Канон:** tsc 314 (diff IDENTICAL) · vitest files 61/63, tests 749/749 — после КАЖДОЙ группы.
**❄️ Frozen (не трогать):** AudioEngineV2.ts, patchV1.ts, bridges/*, track.orchestrator.ts, существующие приватные `_`-поля (новые добавлять можно).

---

## GROUP 1 · Ядро шины — src/audio/engine-v3/pipeline/HybridPipelineService.ts

**H1.1 Поле** — после `:65 _stemRawVolumes`:
```ts
private readonly _busVolumes: Record<string, number> = {}
private readonly _crashedStems = new Set<string>()
private readonly _deadStems = new Set<string>()
```
reset() (:569+) НЕ чистит `_busVolumes` (user-pref переживает смену трека — паритет V2 engine-level); ЧИСТИТ `_crashedStems`/`_deadStems`.

**H1.2 Crash двусторонний (009-fix#4):**
- хендлер :220 (после warn) → `this._crashedStems.add(stemId)`
- `_effectiveGainOf` (:552): первая строка `if (this._crashedStems.has(stemId) || this._deadStems.has(stemId)) return 0`
- resurrection-гвард: в play() (:272) и seek() (:349) прямые записи `stretchGain.gain.value = ...` обернуть `if (!this._crashedStems.has(id))`

**H1.3 API** — рядом с setStemVolume (:482):
```ts
setBusVolume(busId: string, volume: number): void {
  if (!Number.isFinite(volume)) return
  this._busVolumes[busId] = Math.max(0, Math.min(1, volume))
  for (const id of this._chainA.stems.keys()) {
    if (this.busOf(id) === busId) this._applyEffectiveGain(id)
  }
}
getBusVolume(busId: string): number { return this._busVolumes[busId] ?? 1 }
```

**H1.4 Формула** — `_effectiveGainOf` (:552-557) вернуть:
```ts
const bus = this.busOf(stemId)
return muted || !audible ? 0 : Math.max(0, Math.min(1, raw)) * (bus ? Math.max(0, Math.min(1, this._busVolumes[bus] ?? 1)) : 1)
```
Рядом хелпер:
```ts
private busOf(stemId: string): string | null {
  if (stemId === 'instrumental') return null            // master clock-tap инвариант A2.25
  const role = BUILTIN_STEMS[stemId as keyof typeof BUILTIN_STEMS]?.role
  if (!role) return 'music-bus'                          // паритет V2 :1152 unknown→music-bus (009-fix A1)
  return role === 'vocal' || role === 'backing' ? 'vocal-bus'
       : role === 'music' ? 'music-bus' : null           // effect/fx → вне скоупа (фактор 1.0)
}
```
Импорт: `import { BUILTIN_STEMS } from '../../../stem/stemTypes'` (read-only эталон, ❄️ не нарушает).

**H1.5 loadStem tail (:230-238):** в успех-ветку после лога `Single: Stretch only` → `this._applyEffectiveGain(stemId)`; в catch (:232-234) и no-slot (:235-237) → `this._deadStems.add(stemId)` (+снять при повторном успешном loadStem: `this._deadStems.delete(stemId); this._crashedStems.delete(stemId)`).

## GROUP 2 · Гигиена raw (009-fix#1)

**H2.1** stem-engine-sync.ts applyAll (~:225-230): `pipeline.setStemVolume(id, effectiveGain(current,id))` → **`pipeline.setStemVolume(id, current.stemVolumes[id])`** (pipeline сам считает effective; V2-ветке safeDelegate тоже нужен RAW).
**H2.2** resyncV3 (:276+): удалить блок записи effective→raw (:291-298, цикл `stem.volume = effectiveGain...; pipeline.setStemVolume(id, stem.volume)`) — мёртвый код по верификации 009; Оператору: grep вызовов resyncV3 — если живых нет, удалить функцию и экспорт целиком. **📌DC3 (009 fix#1): синхронно удалить/переработать тест** `src/foundation/reactions/__tests__/stem-engine-sync.test.ts` — импорт :23 и блок TC-005 (:104-143), иначе vitest упадёт и канон «зелёный после каждой группы» нарушится.
**H2.3** main.tsx:299-305 блок «gains restored to 1.0» — УДАЛИТЬ (четвёртый отравитель).
**H2.4** main.tsx:235 оставить, добавить коммент «instrumental: значимо только в no-stems режиме».
**H2.5 NaN-гарды:** stem.store.ts:216-219 и pipeline :482-485 — первой строкой `if (!Number.isFinite(volume)) return`.

## GROUP 3 · Store + sync-проводка + КРАСНЫЙ ФЕЙДЕР (GO)

**H3.1** stem.store.ts: слайс `busVolumes: Record<string,number> = {}`, экшн `setBusVolume(busId,v){ if(!Number.isFinite(v)) return; set({busVolumes:{...get().busVolumes,[busId]:clamp(v)}}) }`; initStems/clearStems busVolumes НЕ сбрасывают.
**H3.2** stem-engine-sync.ts: `EngineStateSnapshot` += `busVolumes` (:54-55,:77,:124); в diffAndApply после volume-loop (:152) секция: для изменившихся busId → V3 `pipeline.setBusVersion`… точнее `pipeline.setBusVolume(busId,v)` / V2 `safeDelegate(v2,'setBusVolume',busId,v)`.
**H3.3** stemsEnabled V3-ветка (:198-205 пустая) → реализовать: для стемов с ролью music+backing → `pipeline.setStemMuted(id, !current.stemsEnabled)`; vocals/instrumental не трогаются.
**H3.4 ControlDeck.tsx красный фейдер (GO):** оба обработчика (:184-190 click, :193-207 move):
```ts
const __v3 = (window as any).__v3Active;
const hasMusicStems = /* loadedStems содержит ≥1 id с ролью music (drums/bass/keys/guitar/other) */;
if (__v3 && hasMusicStems) {
  useStemStore.getState().setBusVolume('music-bus', v);
} else {
  if (!__v3) {                                   // 📌DC3: гард от DEV-warn спама обёрткой H4.1 (009 LOW#2)
    const ae = (window as any).audioEngine;
    if (ae) ae.setInstrumentalVolume(v);
  }
  useStemStore.getState().setStemVolume('instrumental', v);   // зеркало всегда (дисплей/синк)
}
if (activeExercise) setInstrumentalOverride(v);
```
Дисплей (:56/:214/:231): источник значения `__v3&&hasMusicStems ? useStemStore(s=>s.busVolumes['music-bus'] ?? 1) : instrumentalVolume`.
Декларация смены контракта (требование атаки A2): в title фейдера и доке пака — «V3-stems: Inst-фейдер = уровень минуса (music-bus); no-stems: инструментал-мастер (как в V2)».

## GROUP 4 · Мини-гард + документация + тесты

**H4.1 bootAether (main.tsx, ПОСЛЕ точки где window.audioEngine уже пропатчен реальными методами; ordering-risk N3):** обернуть 4 метода (`setInstrumentalVolume/setVocalsVolume/setStemVolume/setStemsEnabled`): `__v3Active → DEV-warn+return`, иначе оригинал. Self-contained (под обёрткой в v3-env фасад-no-op; cage идёт через V2Adapter — не задевается). Коммент-assumption: `// assumes VITE_ENGINE=v3; в v2-конфиге patchV1WithV2 перезапишет обёртку позже — принято`.
**H4.2 Документация (в пак-файл):**
- Секция «Bus Volume Model V3»: `effective = clamp(raw) × busFactor`; vocal-bus←vocals+backing; music-bus←drums/bass/keys/guitar/other/**unknown**; master/fx — фактор 1.0.
- **Строка закрытия A2 (вопрос Ц3, эра C27):** «Ответ A2: двойной writer существовал — coldSync (stem-engine-sync.ts:227) писал effective→raw (resyncV3 :297 — мёртвый код). Устранён Шагом GROUP 2 настоящего пака.»
- Риск-реестр: accepted risks — rest ae.* surface без гарда до B-slice; override-keyed-'instrumental' окно до 18-BUS.2; stemsEnabled=false в V3 глушит music+backing (vocals играет).
**H4.3 Тесты (минимум 10):** clamp/NaN таблица vs V2 · формула-матрица ×solo · single-writer static-grep — **whitelist санкционированных writers: setStemVolume-экшн, pipeline.setStemVolume(RAW), loadStem :195 (`gain.value=1.0`, бенигенен), play :272 / seek :349 (под crash-гвардом)** 📌DC3 · порядок setBusVolume ДО loadStem · crash двусторонний · NaN store · регресс симптома №18 (фейдер 37% переживает смену блока, music тише пропорционально) · V2-path safeDelegate('setBusVolume') · cage-инвариант при __v3Active · dual-mode маршрутизация фейдера (stems↔no-stems).
**H3.3b (📌DC3 INFO-страховка):** в applyAll V3-ветку добавить тот же mute-цикл по текущему stemsEnabled — иначе V3 cold-load при stemsEnabled=false оставит music слышимыми до первого переключения.

---
**Порядок применения:** GROUP 1 → checkpoint → GROUP 2 → checkpoint → GROUP 3 → checkpoint → GROUP 4 → полный прогон. Шаги 1-2 независимы от UI.
**Отложено (18-BUS.2/B-slice):** отдельные bus-фейдеры UI, fx-bus, pan, гейтинг остального ae.* surface, дедуп Effects 2d/2f, ремап scenarioMixOverride.
