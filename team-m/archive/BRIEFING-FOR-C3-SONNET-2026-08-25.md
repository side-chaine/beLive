# BRIEFING · beLive v2→v3 (full-light migration) · 2026-08-25 · от 007_Hub
**Кому:** Центр_3 + Соннет. **Тема:** всё, что узнали и наметили; frozen-стоп; список вопросов.
**Статус:** FULL GO от Босса активен, но цепочка агентов СТОПнута на frozen-триггере (приватные `_`-поля). Нужен OVERRIDE Центра.

---

## 0. TL;DR
- Двухмашинная миграция beLive v2→v3 (PC/Hub «Вёдра» + Mac «Задроты») под Боссом, синхрон с Ц3. Модель full-light: Far Light (Mac, read-only анализ → MICRO-PACK) + Near Light (Hub, apply). Operator применяет только на «полный свет».
- **Канон GREEN:** `tsc` = 313 ошибок, `vitest` = 769 passed. Канон = PC-only (на Mac нет node).
- **E1 (предикат) VALID** — единственный писатель `src/main.tsx:148`, 28 мест. Должен идти ДО B-slice.
- **B-slice сходится** (Mac S7 `5aa6487` принял дизайн Hub §7). `MICRO-PACK-B-SLICE-FINAL.md` = **009 GO (doc-level)**.
- **Mac-разведка MIGRATION-HOLES:** после adversarial-стресса итог **P1=5 / P2=10**. Frozen НЕ тронут.
- **R1 zombie-window:** `V3DataInterceptor.ts:166-178` гасит флаг уже играющего трека + `cage.deactivate()` никто не зовёт. Proposal готов → нужен аппрув Ц3.
- 🛑 **FROZEN STOP:** WIP Мака в `MonitorRouter.ts`/`HybridPipelineService.ts` пишет в приватные `_`-поля (`_mainDelay`, `_micDelay`, `_monitorGain`, `_vmixMicGate`, `_micCompensationMs`). Плюс баг `MonitorRouter:254-262` (зануляет `_mainDelay` в обеих ветках, убивая R8) требует правки приватных полей. **OVERRIDE от Центра обязателен.**

---

## 1. Контекст и модель
- **Frozen-зона (железно):** `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`, **приватные поля `_`** — не трогать без OVERRIDE.
- **Коммуникация:** только `team-m/` (SYNC-HUB-TO-MAC, SYNC-MAC-TO-HUB, REGISTRY.md, INBOX.md).
- **FULL GO** от Босса: агенты автономны, Mac делает прогоны и пишет в registry, Hub делает прогоны; сходимся на «полный свет».
- **Блокер apply:** база грязная (незакоммичены `MonitorRouter.ts`, `HybridPipelineService.ts`, `main.tsx` v-Mix-хунки) → Hub держит Operator до чистого базиса.

---

## 2. Что узнали (Findings)

### 2.1 E1 predicate — VALID
`src/main.tsx:148` `ae.setMasterVolume(v)` — единственный писатель мастер-громкости; 28 мест вызова. Подтверждено grep. Должен применяться первым (предикат для B-slice).

### 2.2 B-slice (volume cascade) — сходится
Дизайн из Mac S7, принятый Hub §7:
- **E5:** flag-независимый блок на `delegateSync` `main.tsx:131-151` (до ветки флага) — отсекает dual-write + stale-restore.
- **E8:** `StemChain.setStemVolume:80-83` + `muteStem:74-77` отвергают stub-делегат; единый писатель `_applyEffectiveGain:631-638` (verify-only, НЕ пишет `ae.set*Volume`).
- **E6:** убрать `__guardAeMethod`-обёртки volume `main.tsx:290-291`.
- **`_applySolo:95-103`:** убрать прямые `stem.volume` записи.
- arch-scout проверил: frozen-чисто, single-writer инвариант соблюдён.

### 2.3 Migration holes (Mac, MIGRATION-HOLES.md + stress-holes-verdict.md)
После Ф002-adversarial стресса — **P1=5 / P2=10**:
- **R1** (P1): zombie-window `V3DataInterceptor:166-178` → см. §2.4.
- **Fallback dead-zone** (P1, CONFIRMED): `main.tsx:154-193,364-366` — fail init → track-loaded публикуется, `__v3Active` не ставится, app немой до reload. retry 0, путь восстановления отсутствует целиком (в dual-env НЕ воспроизводится).
- **Takes-audio кластер** (P1): `TransportV3.seek:204` + `useTakesPlayback:108` (seek из idle теряется, natural-end не паузит), `TakesControlStrip:254-268` (vocal-fade мёртв в v3).
- **Маркерный рассинхрон** (P1): `markers-events.ts:39` — active-line/word-sync ≥500ms живут на маркерах предыдущего трека (setTimeout против авто-старта V3); VOC L2/L3 под v3 отключена (фасад без awaitStemReady/getStemAudioBuffer) → dataVersion<4 едут со сдвигом.
- **Phantom methods** (P2, downgraded): `V2Adapter.ts:57` optional-call `(v2)[method]?.()` + фантомные имена `setStemPan`/`setStemsMode` (отсутствуют в frozen V2) → pan/mode умирают молча. Жертв нет (pan-UI не существует, setStemsMode не зовёт никто).
- **Event-surface** (P2, downgraded): `microphone-state-changed`/`vocalmix-state-changed`/`playback-rate-changed`/`track-stem-ready`/`track-fully-loaded` эмиттит ТОЛЬКО V2 → 🎤/VMix-тумблеры + document-плейбек рассинхронизированы в v3.
- **Прочее P2:** `MonitorRouter:281` (program-capture без хозяина), `stem-engine-sync:154` (whitelist-дрейф `setBusVolume`), `MicSourceV3:32-42` (гонка acquire), `takes.recorder:70-98` (гейт по build-time VITE_ENGINE), `DuckGuardV3`/`RehearsalTriggerWriter` (мёртвые контракт-ловушки).

### 2.4 R1 zombie-window
`V3DataInterceptor.ts:166-178` (catch play-timeout): при смене трека во время 5s play-timeout старый catch гасит `__v3Active(false)` у УЖЕ ИГРАЮЩЕГО нового трека. Плюс `cage.deactivate()` не вызывается НИКЕМ (клетка односторонняя). **Proposal (Mac, `r1-c3-proposal.md`):** обернуть ВЕСЬ catch в generation-check + generation-check после `decode+reset+loadStem×N` (:104-179). Verify: канон 313/769 + CDP-гонка + уши mic-сессии.

### 2.5 B1 — 3 недостающих V3-события
arch-scout: v3 переизлучает большинство событий, НО не хватает `track-stem-ready`, `track-fully-loaded`, `vocalmix-state-changed`. `MICRO-PACK-B1-EVENTS.md` готов (additive dispatch в V3DataInterceptor; `AudioEngineV2` НЕ трогаем; `vocalmix-state-changed` — под вопрос Ц3).

### 2.6 A1/A2 — фантомные методы контракта
`IV2PublicContract.ts:33-34,90-91` декларирует `setStemPan`/`setStemsMode`, которых нет в frozen V2 → silent no-op через `V2Adapter.ts:57`. `MICRO-PACK-A1A2-CONTRACT.md` готов (4 строки гигиены, P2).

### 2.7 MonitorRouter/HPS WIP + баг + 🛑 FROZEN STOP
- `MonitorRouter.ts` + `HybridPipelineService.ts` — незакоммиченный WIP Мака, НО по REGISTRY §1 это **PC-зона** (Мак в письме y#3 ретрактнул «почищу сам»).
- **Баг (подтверждён по коду):** `MonitorRouter.setCompensateTarget:254-262` зануляет `this._mainDelay.delayTime.value` в ОБЕИХ ветках (`if monitor → 0 ; else → 0`) → теряет калибровку R8. Плюс дебаг-хвосты `:158/:191/:209`.
- **`ControlDeck.tsx:413`** читает приватный `_monitorGain` через `(router as any)._monitorGain.gain.value` (MON-PROBE).
- **git diff показал:** WIP Мака УЖЕ пишет в приватные `_`-поля: `_vmixMicGate`, `_monitorGain`, `_micCompensationMs`, `_micDelay`, `_mainDelay`. → нарушение frozen-правила.

### 2.8 arch-scout верификация
- B1, A1/A2 подтверждены (frozen-чисто, additive, не трогает frozen-файлы).
- ВСЕ паки Мака (SURFACE/TAKES-AUDIO/holes-drafts) = **NO actionable frozen edit** (только read-only/declarative упоминания).
- 009 ре-гейт = GO (doc-level), precondition: чистый базис + ре-канон 313/769.

---

## 3. Что наметили (MICRO-PACKs)
| Пак | Scope | Статус | Frozen? |
|---|---|---|---|
| E1 | main.tsx:148 master-volume single-writer | VALID, готов | нет |
| B-SLICE-FINAL | E5/E6/E8 + _applySolo (main.tsx/StemChain) | **009 GO** | нет |
| B1-EVENTS | 3 недостающих V3-события | решение-пак готов | нет (additive) |
| A1A2-CONTRACT | гигиена IV2PublicContract (4 строки) | решение-пак готов | нет |
| SURFACE (Mac) | whitelist SSOT + гигиена −setStemPan/−setStemsMode/+setBusVolume + fail-loud + document-parity | draft готов | нет |
| TAKES-AUDIO (Mac) | solo-not-solo + vocal-fade dead + natural-end pause + seek-from-idle | в работе | нет |
| R1→Ц3 | whole-catch generation-check V3DataInterceptor:166-178 | proposal готов, ждёт Ц3 | нет |
| PC-MonitorRouter (НОВЫЙ) | фикс :254-262 + дебаг-хвосты + ControlDeck:413 | **ЗАБЛОКИРОВАН frozen** | **ДА (private `_`)** |

---

## 4. Координация и блокеры
- **FULL GO** активен, агенты автономны.
- **Operator заблокирован:** база грязная (MonitorRouter/HPS/main.tsx v-Mix незакоммичены) → нужен чистый коммит PC-группы ИЛИ санкция Босса.
- **009 GO precondition:** чистый базис + ре-канон 313/769 перед apply.
- **F-1/F-2 pilot (Ox Alpha):** заблокирован до G5 (MonitorRouter/HPS) committed+clean + браузер-тест Босса.

---

## 5. 🛑 FROZEN STOP-TRIGGER — требует OVERRIDE Центра
По протоколу ❄️: любое упоминание frozen-сущности любым агентом = автостоп.
- Mac в `MIGRATION-HOLES.md:26` и письме y#3 упомянул приватные `_mainDelay`/`_monitorGain`.
- Сам фикс бага `:254-262` требует записи в приватные `_mainDelay`/`_micDelay`.
- WIP Мака уже пишет в `_`-поля (возможное нарушение зоны).
**Цепочку держу на стопе. Жду OVERRIDE от Центра.**

---

## 6. Вопросы к Центр_3
1. **R1 — cage.deactivate() владение:** rollback-ветка или bootAether? Аппрув whole-catch generation-check фикса?
2. **OVERRIDE на приватные `_`-поля для `MonitorRouter.ts`/`HybridPipelineService.ts`?** Scope: только фикс `:254-262` или весь WIP Мака? Если НЕТ — как поступить с незакоммиченным WIP (откатить / оставить)?
3. **B1 `vocalmix-state-changed`:** должна ли V3 её эмиттить, или это legacy (оставляем V2)?
4. **Marker globals S1/S2 (`markers-events.ts:39`):** рантайм-резолв против V3 авто-старта — твой дизайн?
5. **Document-state owner для 🎤/VMix:** MonitorRouter эмиттит, ControlDeck НЕ пишет store напрямую (дизайн SURFACE-пака)?

## 7. Вопросы к Соннет
1. **Дисциплина документов:** под FULL GO Босса мы создали `TRIGGER-PROTOCOL.md`, `MIGRATION-HOLES.md`, `MICRO-PACK-*.md`. Твой ранний «стоп-новые-доки-пока-не-Far/Near» — подтверждаешь оверрайд или хочешь вернуть?
2. **Интерпретация frozen-правила:** «приватные поля `_`» — глобально (любой файл) или только внутри 4 названных frozen-файлов? От этого зависит, считать ли WIP Мака нарушением.
3. **Fallback dead-zone (`main.tsx:154-193`):** в dual-env приемлемо (V2 всегда есть) или чинить обязательно для v3-No-Birth? Приоритет?
4. **Приоритет P1:** R1 / fallback / takes-audio / marker-sync — в каком порядке ландим?
5. **Автономия dual-machine (FULL GO):** говернанс-риск по твоей оценке? Нужны ли доп. gate перед Operator-apply?

---

## 8. Предложенная последовательность (после OVERRIDE + чистой базы)
1. Чистый коммит PC-группы (или санкция Босса оставить WIP).
2. **Operator:** E1 → B-slice (FINAL, 009 GO) → A1/A2 → B1 → SURFACE → R1 (после аппрува Ц3) → TAKES-AUDIO.
3. MonitorRouter/HPS-фикс — только ПОСЛЕ OVERRIDE Ц3 (отдельный коммит, вне B-slice).
4. F-1/F-2 pilot при G5 clean + браузер-тест Босса.
5. Сходимся с Ц3 по marker-globals и document-state owner.

**Файлы:** `team-m/MICRO-PACK-B-SLICE-FINAL.md`, `MICRO-PACK-B1-EVENTS.md`, `MICRO-PACK-A1A2-CONTRACT.md`, `MIGRATION-HOLES.md`, `reports/mac-007/{r1-c3-proposal,stress-holes-verdict,MICRO-PACK-SURFACE-draft,MICRO-PACK-TAKES-AUDIO-draft}.md`, `SYNC-HUB-TO-CENTER3-2026-08-25-r1.md`, `REGISTRY.md`.
