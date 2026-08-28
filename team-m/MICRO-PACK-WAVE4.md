# 🌊 MICRO-PACK-WAVE4 · EXEC FINAL v2 (001-reverify → 002 ТРЕБУЕТ ПАТЧА → 009 РЕШЕНО) · 28.08

> Цепь 28.08: 001 реверификация на HEAD e61ee6e (якоря живы, канон 302/761) → 002 стресс (П2: копия одним диапазоном вместо 7) → 009 РЕШЕНО с условиями.
> Канон: tsc=302 / vitest=761+5int+2load / PARITY PASS / frozen-guard GREEN. HEAD: e61ee6e+.
> Frozen: `track.orchestrator.ts` читается ТОЛЬКО как источник копии, byte-identical. `patchV1.ts`, `AudioEngineV2.ts`, `src/bridges/**` — не трогать.

## ЦЕЛЬ
Разорвать последние safe→frozen связи (`track.orchestrator`) через новый SAFE `track.loader.ts`; удалить битый орфан `src/legacy`. V2Adapter НЕ удалять (DEFER — жив: index.ts:59 экспорт, stem-engine-sync.ts:3).

## ПРАВКА-1 · src/services/track.actions.ts

old (:7, точно):
```ts
import { loadTrack as orchestrateLoadTrack } from './track.orchestrator';
```
new:
```ts
import { loadTrack as orchestrateLoadTrack } from './track.loader';
```
+ косметика (:4 коммент): `delegates to track.orchestrator.ts` → `delegates to track.loader.ts`

## ПРАВКА-2 · src/components/MixerPanel.tsx (:180) и src/components/QuickActions.tsx (:214)

old (в обоих, точно):
```ts
const { loadStemsOnDemand } = await import('../services/track.orchestrator');
```
new (в обоих):
```ts
const { loadStemsOnDemand } = await import('../services/track.loader');
```

## ПРАВКА-3 · СОЗДАТЬ src/services/track.loader.ts (1:1 копия, патч П2)

Механическая процедура (Оператор, bash):
```bash
{ echo '// src/services/track.loader.ts — SAFE-перенос loadTrack/loadStemsOnDemand/queueTrackJump (W4).'; echo '// 1:1 копия src/services/track.orchestrator.ts:5-592 (FROZEN первоисточник, byte-identical). НЕ импортирует frozen.'; echo ''; sed -n '5,592p' src/services/track.orchestrator.ts; } > src/services/track.loader.ts
```
Состав копии (проверено 001/002/009): импорты :5-14 (ai-lyrics-sync.service, stemTypes, idb.service, stem.store — все SAFE), LoadTrackOptions :15-18, module-state :20-27 (_autoplayTimer/_prevStemUrls/_pendingJump — легальны в SAFE-файле), loadTrack :29-497, loadStemsOnDemand :499-564, queueTrackJump :566-587, window-регистрации :589 (`window.queueTrackJump`) + :592 (`window.trackOrchestrator`).

## ПРАВКА-4 · DELETE src/legacy целиком

9 файлов: `src/legacy/engine-v3/{CaptureBusV3,CrossfadeV3,LoopEngineV3,MicrophoneV3,RateParamV3,StemPlayerV3,VocalMixV3}.ts` + `src/legacy/engine-v3/__tests__/{engine-v3.test,vocal-mic.test}.ts` + пустые каталоги (`src/legacy/engine-v3/__tests__/`, `src/legacy/engine-v3/`, `src/legacy/`).
Обоснование: 0 внешних импортов (grep); внутренние импорты битые (`./V2Adapter`, `./types`, `../MeterNodeV3` — файлов нет в legacy) → TS2307 + 2 load-fail.
`src/audio/engine-v3/V2Adapter.ts` — **НЕ ТРОГАТЬ (DEFER)**.

## ГЕЙТЫ (каждый = стоп при fail; условия 009 обязательны)

1. **tsc: дифф МНОЖЕСТВА ошибок, НЕ счёт** (условие 009 #1): `npx tsc --noEmit 2>&1 | grep "error TS"` ДО/ПОСЛЕ. Ноль ошибок, ссылающихся на `track.loader.ts`/`track.actions.ts`/`MixerPanel.tsx`/`QuickActions.tsx`. Снижение счёта легально (уходят TS2307 из src/legacy) — зафиксировать новый базис числом.
2. `npx vitest run` → **761 passed + 5 intentional, 0 load-fail** (было 2 — удалены с legacy); files минус 2; passed не упал.
3. PARITY PASS: `npm run verify:ci`.
4. SHA256 frozen ДО/ПОСЛЕ идентичен: `find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum` (baseline: `/tmp/opencode/frozen-pre-v3active.sha`, 21 файл).
5. ⛔-отчёт: `grep -rn "track\.orchestrator" src --include='*.ts*' | grep -E "import|from"` → **0**; ожидаемые остаточные комменты: lyrics.store.ts:26, track.orchestrator.ts:1 (сам), track.loader.ts шапка, event-bus/README.md:59. V2Adapter RETAINED: index.ts:59 экспорт на месте.
6. `grep -rn "from './track.loader'" src/services/track.actions.ts` = 1; `grep -rn "track.loader" src/components/MixerPanel.tsx src/components/QuickActions.tsx` = 2.
7. frozen-guard: `node team-m/bLb/frozen-guard.mjs` → 🟢 GREEN; `ls src/legacy` → не существует.
8. **M3-VERIFY (Ц3 4.1b, обязательно для закрытия W4):**
   - (0) `npm run build`; инвентарь: `find dist -type f | sort` → классы {чанк / статик / known-retained-M5}
   - (1) negative (non-DEV литералы V2, проверены 002 в AudioEngineV2.ts:361,:409): `grep -c "vocalsUrl provided — skipping additionalStems.vocals" dist/assets/*.js` = 0 И `grep -c "Vocals load failed, instrumental-only mode" dist/assets/*.js` = 0 (V2 уже вне бандла на HEAD — это регресс-страховка, PASS ожидается)
   - (2) positive ПЕРВЫМИ: `getStemMeterLevel`, `loopcompleted`, `audioglitch` в `dist/assets/*.js` ≥1 каждый (если getStemMeterLevel=0 при остальных ≥1 — подозревать минификацию, не регрессию)
9. R1-smoke (Босс, после коммита): `window.queueTrackJump` зарегистрирован на буте; Shift+Arrow переключает трек; загрузка трека работает.

## РИСКИ
- R1 поглощён: window-регистрации в track.loader (App.tsx:9 → track.actions → track.loader статическая цепочка на буте).
- R2: единый eval-имый инстанс state (dyn-импорты резолвятся в тот же модуль).
- R3: tsc-базис снизится — зафиксировать числом в ledger.

## OUT OF SCOPE
- V2Adapter (DEFER до Gate 3B/Этап 4).
- P2 (coldSync re-arm), P3 (takes.duck MP-23) — очередь микро-паков.
- 6 потребителей track.actions (App.tsx:9, catalog.store.ts:8, CatalogLayout.tsx:6, waveform-editor.stub.ts:2, upload.service.ts:15, UploadPanel.tsx:718) — НЕ трогать.
