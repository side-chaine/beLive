# WAVEB-001-CIRCLE3 — ФИНАЛЬНАЯ СПЕКА Волны B «КОНТРАКТ-ЗАКРЫТИЕ»
**001 (CEO Co-Architect) · Круг-3 · 2026-09-01 · HEAD `a8a3867` · вход: tsc=290(ошибок) · vitest=808+0int+0load/69 · frozen 18/18**
**Таргет: tsc=290 Δ0 · vitest=808+0int+0load/69 Δ0 · verify:frozen=17/17 · PARITY PASS. 0 новых тестов.**

Переформулировка: похоронить V2-контракт (orchestrator + V2Adapter-пара + мёртвый мок-ключ) и убрать 3 V2-хвоста в живых файлах (mount-эффект, duration-цепь, _audioContext) — 3 коммитами, без новых абстракций.

---

## ОТВЕТЫ НА УДАРЫ (1-6)

**У1 — ПРИНЯТ (канон-ломающий).** Grep-факт сильнее цифры 002: mockV2 живых строк = 6 после патча (`:10` decl, `:40`, `:47`, `:50`, `:73`, `:86`; седьмая `:17` уходит вместе с ключом фабрики). Удаление объекта = ReferenceError → падает весь файл → 808−N. Патч 002 дословно: из vi.mock-фабрики удалить ТОЛЬКО ключ `V2Adapter`, mockV2-объект ОСТАВИТЬ. → А3.

**У2 — ПРИНЯТ + CEO-расширение того же класса.** Note манифеста «3 зоны · 18 файлов (FROZEN-AUDIT-301 §7, wc=5137)» и `.gitattributes:9` верифицированы. Один коммит с git rm. Расширение: README event-bus `:55` («verify:frozen, 18/18») и `:60` (даш-строка orchestrator) — то же самопротиворечие в соседнем файле; правим в том же коммите, иначе чиним note, а README врёт. → А1.

**У3 — ПРИНЯТ.** `stem-engine-sync.ts:3` «Central Bridge: Zustand subscribe → V2Adapter.delegateSync» — шапка-ложь уже сейчас (0 вызовов с W2b). → А7.

**У4 — ПРИНЯТ.** Шкала tsc-канона = ОШИБКИ (MICRO-PACK C: «293→290, Δ−3 = 3 ошибки внутри снесённых»). В сносимых файлах 0 ошибок → Δ0. Мой прогноз Круга-1 «→287 файлов» отозван как подмена шкалы. Таргет: **tsc 290 Δ0**.

**У5 — ПРИНЯТ.** `ae?.audio?.duration` мёртв в ОБОИХ режимах (фасад и настоящий V2 не имеют `.audio`; живой V2-хвост = `getDuration()` :1737). Цепь: `pipeline?.duration ?? ae?.getDuration?.() ?? 0`. → А5.

**У6 — ПРИНЯТ.** BusFader18: импорта V2Adapter нет, `delegateSync` = локальная `vi.fn()` (:425-428), тест ассертит свои моки — имя-фикция. Переименование :418 + :14, канон 808 Δ0 (имя ≠ ассерт). → А8.

Вычеркнутый 002 (implements-цепь) — подтверждён фальшивым моим grep'ом: `IV2PublicContract` в src/ = только V2Adapter.ts (:6,:12,:16,:26,:28) и сам файл, оба сносимые; `implements IV2PublicContract` = 0. Frozen не задет.

---

## АТОМЫ А1-А8 (файл:строка, старое→новое дословно)

**Коммит-план: C1 = А1 · C2 = А2+А3+А7+А8 (гейт «V2Adapter→0») · C3 = А4+А5+А6.** После КАЖДОГО коммита: `tsc` 0 новых + `vitest` зелёный + `verify:frozen` зелёный. Финал: все grep-гейты (см. КАНОН-ИНВАРИАНТ).

### C1 — frozen-атом

**А1.1** `git rm src/services/track.orchestrator.ts`

**А1.2** `frozen-manifest.json`, блок `guard` — DELETE строку:
```
    "src/services/track.orchestrator.ts": "b8818e66e5cd5ff6ce158cdc6d02f824c9190c1cce4a6c555b73ad94946199bd",
```

**А1.3** `frozen-manifest.json`, поле `note` — старое:
```
Канон: 3 зоны · 18 файлов (FROZEN-AUDIT-301 §7, wc=5137)
```
новое:
```
Канон: 2 зоны · 17 файлов (FROZEN-AUDIT-301 §7; Волна B 01.09: −track.orchestrator 592, wc=4545)
```
wc-факт = сумма строк 17 файлов манифеста (`wc -l` по ключам guard+graveyard). Прогноз 4545 = 5137−592. Если факт ≠ 4545 — заменить число на факт ДО коммита (не STOP).

**А1.4** `.gitattributes:9` — DELETE строку:
```
src/services/track.orchestrator.ts                           -text
```

**А1.5** `src/foundation/event-bus/README.md:55` — старое:
```
> Операционный канон — `frozen-manifest.json` (verify:frozen, 18/18) + док-SSOT `frozen-zones-v2.md`; списки ниже — срез на дату.
```
новое:
```
> Операционный канон — `frozen-manifest.json` (verify:frozen, 17/17) + док-SSOT `frozen-zones-v2.md`; списки ниже — срез на дату.
```

**А1.6** `src/foundation/event-bus/README.md:60` — DELETE строку:
```
- src/services/track.orchestrator.ts ❄️
```

### C2 — гейт-коммит «V2Adapter→0»

**А2.1** `git rm src/audio/engine-v3/V2Adapter.ts`
**А2.2** `git rm src/audio/engine-v3/IV2PublicContract.ts`

**А2.3** `src/audio/engine-v3/index.ts:58-59` — DELETE обе строки (экспорт + осиротевший коммент; CEO-расширение: :58 без :59 = висячий якорь):
```
// Legacy — retained for frozen V2 access
export { V2Adapter } from './V2Adapter'
```

**А3.1** `src/foundation/reactions/__tests__/stem-engine-sync.test.ts:9` — старое:
```
// V2Adapter mock
```
новое:
```
// mockV2 — истор. заглушка (V2-обёртка снесена Волной B); живые строки ниже ассертуют мёртвый канал
```

**А3.2** `stem-engine-sync.test.ts:14-19` — старое:
```
vi.mock('../../../audio/engine-v3', () => ({
  V2Adapter: {
    getInstance: () => mockV2,
  },
  getTransport: vi.fn(),
}))
```
новое:
```
// Волна B: ключ V2Adapter удалён из фабрики (класс снесён); mockV2-объект оставлен —
// 6 живых строк (:40/:47/:50/:73/:86 + decl) ассертят, что мёртвый канал не зовётся.
vi.mock('../../../audio/engine-v3', () => ({
  getTransport: vi.fn(),
}))
```
mockV2-объект `:10-14` НЕ трогать. Истор-комменты `:53`/`:67` НЕ трогать.

**А7.1** `src/foundation/reactions/stem-engine-sync.ts:3` — старое:
```
// Central Bridge: Zustand subscribe → V2Adapter.delegateSync
```
новое:
```
// Central Bridge: Zustand subscribe → pipeline (V3) / legacy-движок (V2-делегация снесена W2b)
```

**А7.2** `src/audio/engine-v3/monitor/MonitorRouter.ts:266` — старое:
```
  /** Connect mic (V2Adapter.enableMicrophone calls this) */
```
новое:
```
  /** Connect mic (legacy-канал enableMicrophone; V2-обёртка снесена Волной B) */
```

**А7.3** `src/sync/components/WaveformCanvas.tsx:433` — старое:
```
          // Simple click → seek (via V2Adapter)
```
новое:
```
          // Simple click → seek (через TransportV3)
```

**А7.4** `WaveformCanvas.tsx:437` — старое:
```
            // M2 (2a): в V3-режиме seek идёт через TransportV3, не через V2Adapter (который блокируется)
```
новое:
```
            // M2 (2a): в V3-режиме seek идёт через TransportV3 (прямой V2-путь заблокирован гардом)
```

**А7.5** `src/foundation/event-bus/wrappers/position-sync.ts:38` — старое:
```
  /** Обновить currentTime из V2Adapter (AudioEngineV2 имеет getCurrentTime(), НЕ свойство currentTime) */
```
новое:
```
  /** Обновить currentTime из legacy-движка (AudioEngineV2 имеет getCurrentTime(), НЕ свойство currentTime) */
```

**А7.6** `src/foundation/event-bus/wrappers/rehearsal-trigger-writer.ts:6` — старое:
```
// Замена 17× (window as any).audioEngine на V2Adapter.
```
новое:
```
// Замена 17× (window as any).audioEngine на TransportV3 (истор.: ранее V2-обёртка, снесена Волной B).
```

**А7.7** `src/takes/takes.time.ts:22` — старое:
```
/** Seek: через TransportV3 при активном V3, иначе через V2Adapter. */
```
новое:
```
/** Seek: через TransportV3 при активном V3, иначе через legacy-движок (V2-обёртка снесена Волной B). */
```

**А7.8 (CEO-добавка, класс У2)** `src/stores/lyrics.store.ts:26` — старое:
```
// The frozen track.orchestrator populates a RAW lyrics mirror (before word-sync
```
новое:
```
// The track loader (ex-track.orchestrator, снесён Волной B) populates a RAW lyrics mirror (before word-sync
```
Строки :27-29 (продолжение коммента) НЕ трогать. Механизм BAC-001 истинен: mirror наполняет track.loader (1:1 копия, Step 8 тот же).

**А8.1** `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts:418` — старое:
```
  it('cage-инвариант: гард задевает только ae.*, канал V2Adapter.delegateSync работает при __v3Active', () => {
```
новое:
```
  it('cage-инвариант: гард задевает только ae.*, delegateSync-канал не задет (истор.: V2Adapter снесён Волной B)', () => {
```
Тело теста (:419-433) НЕ трогать.

**А8.2** `BusFader18.test.ts:14` — старое:
```
 *  9. cage-инвариант H4.1: гард ae.* блокирует при __v3Active, V2Adapter-канал не задет
```
новое:
```
 *  9. cage-инвариант H4.1: гард ae.* блокирует при __v3Active, delegateSync-канал не задет
```

### C3 — юзер-видимые фиксы

**А4** `src/sync/components/SyncEditorPanel.tsx:102-110` — DELETE целиком (9 строк: коммент + on-mount-эффект):
```
  // Sync slider with actual audioEngine values on mount
  useEffect(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    const iVol = ae.instrumentalGain?.gain?.value ?? 1;
    const vVol = ae.vocalsGain?.gain?.value ?? 1;
    useStemStore.getState().setStemVolume('instrumental', iVol);
    useStemStore.getState().setStemVolume('vocals', vVol);
  }, []);
```
Обоснование (усиление 002): `instrumentalGain`/`vocalsalsGain` нет НИ у фасада, НИ у настоящего V2 → эффект писал 1 ВСЕГДА, в любом режиме → DELETE = чистый фикс без V2-регрессии. Слайдер реактивен: `:47-48` = zustand-селекторы в render; single-writer сохранён (UI → стор → stem-engine-sync → pipeline). Проверено: `useStemStore` (`:47-48`) и `useEffect` (`:90`) остаются использованными → tsc noUnusedLocals не сработает.

**А5** `SyncEditorPanel.tsx:620-623` — старое:
```
      // Duration: from audioEngine (most reliable)
      const duration = ae?.audio?.duration
        || ae?.getDuration?.()
        || 0;
```
новое:
```
      // Duration: V3 pipeline.duration (HPS:149) → V2 getDuration() → 0 (Волна B: мёртвый ae.audio.duration удалён)
      const duration = (window as any).__belive?.pipeline?.duration
        ?? ae?.getDuration?.()
        ?? 0;
```
`??` (не `||`) — сознательно: pipeline.duration=0 при V3-мастере = истина «нет трека», не маскировать stale-V2 числом.

**А6** `src/takes/takes.recorder.ts:108` — старое:
```
      ? ((window as any).__belive?.pipeline?.ctx ?? ae.audioContext ?? ae._audioContext)
```
новое:
```
      ? ((window as any).__belive?.pipeline?.ctx ?? ae.audioContext)
```
`:109` (V2-ветка, dormant failover) НЕ трогать.

---

## КАНОН-ИНВАРИАНТ (числа + grep-гейты + whitelist + СТОП)

**Числа (после C3):** tsc = **290 ошибок Δ0** (0 ошибок в сносимых — DEFREEZE-A/MICRO-PACK C; implements-цепи нет) · vitest = **808 passed + 0int + 0load / 69 файлов Δ0** (mockV2 жив → файл грузится; переименование :418 ≠ ассерт) · `verify:frozen` = **17/17** (guard=2: AudioEngineV2 + live-guard; graveyard=15) · PARITY PASS.

**Grep-гейты (финальные, все — обязательны):**

(а) `git grep -n "V2Adapter" src/` → РОВНО 3 строки (whitelist):
1. `src/foundation/reactions/__tests__/stem-engine-sync.test.ts:53` — истор. запись (не тронута)
2. `src/foundation/reactions/__tests__/stem-engine-sync.test.ts:67` — истор. запись (не тронута)
3. `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts:418` — новое имя, маркер «истор.»

(б) `git grep -n "track.orchestrator" src/` → РОВНО 2 строки (whitelist):
1. `src/services/track.loader.ts:2` — истор. провенанс «1:1 копия…» (не тронута)
2. `src/stores/lyrics.store.ts:26` — новая формулировка, маркер «снесён Волной B»

(в) `git grep -n "_audioContext" src/` → РОВНО 1 строка: `src/takes/takes.recorder.ts:109` (V2-ветка).

(г) `git grep -nE "instrumentalGain|vocalsGain" src/sync/` → 0 строк.

(д) Манифест: guard=2 · graveyard=15 · frozen 17 · note «2 зоны · 17 файлов».

**СТОП-условия (любое срабатывает — волна останавливается, отчёт 007, никакого самовольного фикса):**
- tsc: любая новая ошибка или итог ≠ 290.
- vitest: итог ≠ 808/69, любой interrupted/load-fail, падение stem-engine-sync.test или BusFader18.test.
- verify:frozen: ≠ 17/17, любой ERROR, новый WARN.
- Гейт (а): строк больше 3 или список не совпадает с whitelist дословно.
- Гейты (б)/(в)/(г): любое отклонение.
- wc-факт 17 файлов манифеста недостоверно воспроизводим (само число ≠ 4545 — НЕ STOP: записать факт в note).

---

## САМОКРИТИКА

1. **Счёт живых mockV2-строк: у 002 «4», у меня grep-факт 6** (:40/:47/:50/:73/:86 + decl :10; :17 уходит с ключом). Суть У1 неизменна и усилена; спека на моих верифицированных номерах.
2. **CEO-добавки сверх буквы диспатча** — все одного класса У2 «правим якорь, а сосед врёт»: README:55/60 (А1.5-1.6), index.ts:58 (А2.3), lyrics.store:26 (А7.8). Помечены в атомах; требуют подтверждения Босса (см. ниже).
3. **Доки НЕ в волне:** docs/architecture/* содержит 20+ упоминаний orchestrator (frozen-zones-v2.md:2-3 «18 файлов», README.md:15, interaction-schema, architecture-map и др.). Доки = истор. срезы, не операционный канон; doc-sweep = лишние движущиеся части в снос-волне. Цена: дрейф доков до doc-волны. Гейты умышленно scoped to `src/`.
4. **А5 `??` vs `||`:** выбран `??` — pipeline.duration=0 (V3-мастер, нет трека) не должен маскироваться stale-числом V2. Поведение без трека: 0 → не хуже текущего.
5. **А4 tsc-риск закрыт:** useStemStore/useEffect остаются использованными; удаление 9 строк не создаёт unused-import.

---

## Требует решения CEO/Босса

1. **SyncEditor:104 — ПОДТВЕРЖДАЮ решение Круга-1: в волне (А4, коммит C3), НЕ hotfix.** Почему: DELETE 9 строк, нулевая цена; отдельный hotfix-цикл = лишняя движущаяся часть ради нуля. Дефект юзер-видимый, но не деструктивный (глушение инструментала при открытии Sync-панели переживает один коммит-цикл).
2. **Подтвердить CEO-добавки:** README:55/60, index.ts:58, lyrics.store:26 — класс У2 (самопротиворечие/осиротевший якорь в том же коммите). Отказ = оставить враньё, которое 002 уже карал ударом 2.
3. **Опция 002 «C3 первым» отклонена:** C3 не зависит от сносов, но ядро волны — контракт-похороны (C1+C2); перестановка ради выигрыша одного коммита = перестройка порядка без нужды. Порядок: C1 → C2 → C3.

**Итог: 6/6 ударов ПРИНЯТЫ (У1 с уточнением счёта живых строк), 1 вычеркнутый подтверждён фальшивым, 8 атомов / 3 коммита, 0 новых тестов, 0 новых абстракций. Спека исполнима без интерпретаций.**
