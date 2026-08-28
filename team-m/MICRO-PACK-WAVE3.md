# 🌊 MICRO-PACK-WAVE3 · demolition · handoff (FINAL v2 · chain 001→002→001→009 + D1-D3 re-check, 28.08)
> v2: патч D1-D3. Цепь: 009 ОТЛОЖЕНО(D1-D3) → 001 патч → 002 ТРЕБУЕТ ПАТЧА(4 удара) → 001 re-check → 009 РЕШЕНО (GO-FOR-OPERATOR условный). Применение СТРОГО из этого текста. Hub(007) диспатчит Operator post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/767+5int+2load. W1 вырезал `tryActivateV2` (No-Birth) ⇒ V2 не стартует ⇒ V2-silence-код мёртв (R1 MITIGATED-by-W1). restore-ветка → crash-modal (НЕ тихий V2-restore). BusFader18 §9 RETAIN (аннотация). DuckGuardV3 ВКЛЮЧЁН в W3 (до W4, иначе tsc-падение при удалении V2Adapter).

## ЦЕЛЬ
Leaves-first снос V2-демо/силенс-классов и обёрток (ВСЕ SAFE-файлы): `__switchToV3`, ae-guard `wrap`, `V2AudioCage`, `V2ResurrectionDetector`, `DuckGuardV3`, restore-ветка→crash-modal + 5 комментариев с канон-терминами. BusFader18 §9 — аннотация (retain).

## ⚠️ ДИСЦИПЛИНА ЯКОРЕЙ (глобально, обязательно)
**Номера строк = pre-edit. Перед каждым сносом спан фиксируется grep'ом по тексту/якорю, НЕ по номеру.** (Защита от дрейфа якорей при сносе снизу-вверх; см. АТОМАРНЫЙ ПОРЯДОК.)

## ПРАВИТЬ (SAFE) — один коммит
1. `src/audio/engine-v3/integration/V3DataInterceptor.ts`
   - L4 удалить `import type { V2AudioCage } …`
   - L43 удалить `private _cage: V2AudioCage | null = null;`
   - L57–61 удалить метод `attachCage(...)` (вкл. string-literal `V2AudioCage` в console.log :60)
   - L171–173 удалить блок активации (`// Активируем клетку V2` + `this._cage?.activate()`)
   - L179 коммент → `// новый трек всегда стартует с 0. (Хендофф был легален только в консольном переключателе — удалён в W3.)`
2. `src/audio/engine-v3/integration/V2ResurrectionDetector.ts` → **DELETE**
3. `src/audio/engine-v3/integration/V2AudioCage.ts` → **DELETE**
4. `src/main.tsx`
   - L17 удалить `import { V2AudioCage } …`
   - L44 удалить `import { useStemStore } …` (осиротевший: все 6 использований L233/234/236/237/238/246 только внутри L214-263; noUnusedLocals=true ⇒ иначе TS6133)
   - L121–126 удалить cage-блок (`new V2AudioCage()` / `attachCage` / `__v2Cage`)
   - L147–157 (`handleV3BootFailure`): удалить **ТОЛЬКО L154** `;(window as any).__restoreV2Engine?.()` — остальное (crash-modal) **СОХРАНИТЬ**
   - L214–263 удалить блок `__switchToV3` целиком (коммент-заголовок L214 + async-def L215-263; вызовов из др. кода НЕТ)
   - L265–292 удалить ae-guard wrap-блок (`__guardAeMethod('setStemVolume'/'setStemsEnabled')`); спан зафиксировать grep `__guardAeMethod` до правки
   - L332–336 удалить 5 строк коммент-блока про `V2AudioCage.activate()` (от `// 🧟 MP-18: V2 silencing…` до голого `//` включительно); L337-338 (№18-BUS H2.3) **СОХРАНИТЬ**
   - **СОХРАНИТЬ** (исчерпывающе для зоны L194-294): L194-212 (консоль-expose `__getTransport`/`__tp`/`__v3*`), L264, before-track-change c L294 (кроме коммента L332-336). Смежные пустые L213/L264/L293 допустимо схлопнуть до одной.
5. `src/audio/engine-v3/DuckGuardV3.ts` → **DELETE**
6. `src/audio/engine-v3/__tests__/duck-guard.test.ts` → **DELETE**
7. `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts` → **RETAIN** + аннотация (§9), точный текст: `contract-mirror, intentionally retained (museum) — регресс-нетто pin-semantics; ae-guard удалён из прод-кода W3, тест self-contained`. Без правок логики.
8. **КОММЕНТ-ПРАВКИ** (канон-термины `__switchToV3|V2AudioCage|ResurrectionDetector|DuckGuardV3` в новых текстах **ЗАПРЕЩЕНЫ**):
   - `src/audio/engine-v3/monitor/MonitorEngine.ts:271` → `/** Принять состояние от legacy-микшера (зарезервировано: единственный вызывающий удалён в W3, кандидат W4/W5). */`
   - `src/foundation/event-bus/wrappers/position-sync.ts:41` → `// V3DataInterceptor грузит стемы до авто-старта V3, state остаётся 'idle'.`
   - `src/audio/engine-v3/core/TransportV3.ts:125` → убрать `(e.g. __switchToV3) ` → ` * can start-at-position in one call instead of playing from`

## АТОМАРНЫЙ ПОРЯДОК (1 коммит)
Файловый порядок: V3DataInterceptor(cage-out + коммент L179) → DELETE V2ResurrectionDetector → DELETE V2AudioCage → main.tsx → DELETE DuckGuardV3 + duck-guard.test.ts → BusFader18 RETAIN+аннотация → коммент-правки (MonitorEngine/position-sync/TransportV3).

**Внутри main.tsx — истинно СНЗУ ВВЕРХ.** Обоснование: снос 214-263(−50)+265-292(−28)+L154(−1)+121-126(−6) = **−85 строк выше 332** ⇒ комменты физически встанут на 247-251, а `beforeunload`-cleanup (orig L417-421) — на 332-336; слепой номер «332-336» вырежет `bridgeFacade.destroy()` в обход всех 8 гейтов (тихая регрессия). Порядок:
  **1) комменты 332-336 → 2) ae-guard 265-292 → 3) __switchToV3 214-263 → 4) L154 → 5) cage 121-126 → 6) импорты L44, L17.**
(Гарантирует 0 импортёров V2AudioCage перед DELETE; V2ResurrectionDetector импортирует cage типом ⇒ удаляется до/вместе с cage.)

## НЕ ТРОГАТЬ (Frozen + живой V3-код)
AudioEngineV2.ts · patchV1.ts · bridges/* (вкл. live-guard; `main.tsx:6` allowlist НЕ трогать) · track.orchestrator.ts · `_`-поля внутри frozen. **+ `DuckGuardV3Native`** (живой V3-класс: DuckGuardV3Native.ts:8, engine-v3/index.ts:24, StemPlayerV3.ts:1/41/74) — **НЕ трогать**.

## ГЕЙТ (Operator, post-apply; каждый = СТОП при fail)
1. `tsc --noEmit` → 0 NEW vs канон **306** (только удаления ⇒ ==306).
2. `vitest run` → **проекция 761** (от базиса 767; −6 из duck-guard.test.ts, ровно 6 `it()`).
3. PARITY PASS.
4. SHA256 frozen (AudioEngineV2/patchV1/bridges/*/track.orchestrator, 21 файл) ДО/ПОСЛЕ идентичен.
5. `rg -i "v2recovery|__restoreV2Engine" src` → 0 (js-def — W5). ⛔-отчёт Ц3 present.
6. **ГЕЙТ-6** (только GNU grep или ripgrep; `\b` на BSD-grep/Mac молча деградирует → ложно-зелёный):
   - Позитив-контроль **ДО** (обязан быть НЕНУЛЕВЫМ, иначе «0 после» ничего не доказывает): `grep -rnE '\b(__switchToV3|V2AudioCage|ResurrectionDetector|DuckGuardV3)\b' src` → сейчас **35 хитов**.
   - Гейт **ПОСЛЕ**: та же команда → **0**. (rg-эквивалент: `rg -n -w '__switchToV3|V2AudioCage|ResurrectionDetector|DuckGuardV3' src` → 0.)
   - Негатив-контроль **ПОСЛЕ**: `grep -rn 'DuckGuardV3Native' src` → **≥5** (Native пережил волну; `\b` не over-матчит).
7. Frozen-guard 🟢 GREEN (0 новых safe→frozen).
8. BusFader18 §9 annotated (точный текст выше); контракт-зеркало-тест green.

## РИСК-НОТЫ
- **R1 MITIGATED-by-W1**: V2 No-Birth ⇒ double-playback невозможен; cage/ae-guard/ResurrectionDetector удалены как dead-code. УСЛОВИЕ: при возврате V2-активации R1 возвращается без силенсера — держать V2 спящим.
- Удаление `DuckGuardV3` сейчас предотвращает падение tsc при W4-удалении `V2Adapter` (`DuckGuardV3.ts:7` import V2Adapter).
- `__restoreV2Engine`: W3 убирает вызывающего (main.tsx:154), деградация = crash-modal; мёртвый def в `js/audio-facade-v3.js` до W5.
- `MonitorEngine.adoptState` теряет единственного вызывающего (main.tsx:255) → мёртвый; в W3 **НЕ удалять** (живой файл, публичный API), кандидат W4/W5. `__legacyMonitorMix` не имеет writer'ов во всём репо ⇒ ветка adoptState мертва уже сейчас.

## ДИСЦИПЛИНА W3 (Ц3 4.1a)
Ретир V2 поимённо («V2-recovery-ветки»: `__switchToV3`/`V2AudioCage`/`V2ResurrectionDetector`/`DuckGuardV3`/`__restoreV2Engine`), **ноль wildcard**, grep-верификация канон-терминов в diff-чеке Operator'а (каждый удалённый символ подтверждён grep'ом, что он больше не зовётся).

## СТАТУС
FINAL v2 (РЕШЕНО после D1-D3 патча; 009 GO-FOR-OPERATOR условный). Применение — строго из этого текста, post-M3-GO по санкции Босса. Условия 009: (а) применять из этого текста, не из сталого; (б) этот текст = SSOT (переписан); (в) все 8 гейтов fail-loud, гейт-6 только с `\b` + позитив(≠0)/негатив(Native≥5) контроли.