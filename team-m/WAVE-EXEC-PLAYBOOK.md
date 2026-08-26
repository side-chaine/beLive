# 🚀 WAVE-EXEC-PLAYBOOK · для Hub (007_Винда) — исполнение M3-GO + 5 волн

> Мак (007_Мак) подготовил. Hub применяет post-одного-GO Босса. Frozen-файлы НЕ трогать (только чтение + SHA256-инвентарь).
> Источники: `MICRO-PACK-WAVE1..5.md`, `WAVE-FROZEN-INVARIANTS.md`, `WAVE-HANDOFF-INDEX.md`, `WAVE-PREFLIP-BASELINE.md` (live счётчики), `SYNC-HUB-TO-MAC-2026-08-26k.md` (flip-спека).

## 0. ПРЕ-ФЛАЙТ (один раз, ДО флипа)
```
npm run typecheck && npx vitest run && npm run verify:ci   # MUST BE GREEN (канон 306/772 + PARITY)
node team-m/bLb/frozen-guard.mjs                            # 🟢 GREEN (0 new safe→frozen). RED → СТОП + реестр.
find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum > /tmp/frozen-pre.sha
```

## 1. M3-GO FLIP (1 коммит, frozen НЕ трогаем)
- `src/engine-mode.ts:5`: `(import.meta.env?.VITE_ENGINE as 'v2'|'v3'|undefined) ?? 'v2'` → `'v3'`
- `.env.example:23`: `VITE_ENGINE=v2` → `v3`
- Гейт: `grep -rn "import.meta.env.VITE_ENGINE" src` → ровно 1 файл (`engine-mode.ts`); `npm run dev` → V3 по умолчанию; `VITE_ENGINE=v2` даёт legacy. canon GREEN.

## 2. ВОЛНЫ (leaves-first, ПО ОДНОЙ; между волнами — Frozen-guard GREEN + SHA256 совпал)
Живые счётчики (`WAVE-PREFLIP-BASELINE.md`): **delegateSync 23**, **V2Adapter 27**, **globals 9 safe-файлов (12 reader-сайтов)**, **track.orchestrator 7**.

### W1 — activation cut + BAC-105 (V2-globals re-point)
- **Safe:** 9 файлов с `window.audioEngine/.app/.trackCatalog/.liveMode/.lyricsDisplay/.markerManager/.waveformEditor` (`mode-switch.service`,`block-scene.service`,`track.actions`,`FullAvatar`,`useStemWaveform`,`useBackgroundManagers`,`trigger-visual`,`MonitorMixPanel`,`upload.service`, …) → V3-state / E1-предикат / удалить чтение глобала.
- **Frozen:** НЕ трогать.
- **Гейт:** `grep -rn "window.audioEngine\|window.__belive" src --include='*.ts*'` → 0 runtime (комментарии ок); canon GREEN; boot-smoke CDP V1/V5.

### W2 — delegateSync + V2Adapter re-point
- **Safe:** 23 caller `delegateSync` + 27 импортёров `V2Adapter` (вне engine-v3) → V3-surface. `V2Interceptor-wrap` + `V2Adapter.ts` НЕ удалять (до последнего caller).
- **Гейт:** `grep -rln "delegateSync" src` → все на V3-surface; `grep -rln "V2Adapter" src` → ТОЛЬКО `src/audio/engine-v3/V2Adapter.ts` (импортёров 0). canon GREEN.
- ⚠️ Расхождение V2Adapter: Mac grep 26 vs baseline 27 — критерий = `grep→0`, не число; сверить при apply.

### W3 — stub-миграция (BAC-107)
- **Safe:** live-mode / waveformEditor stub + `facade.ts:51` → V3 или удалить dead-stub.
- **Гейт:** canon GREEN; boot-smoke.

### W4 — orchestrator re-point + legacy/V2Adapter delete
- **Safe:** 6 потребителей `track.actions.ts:7` re-point; `MixerPanel.tsx:180`+`QuickActions.tsx:214` dyn-import orchestrator удалить; `V2Adapter.ts` УДАЛИТЬ ТОЛЬКО если `grep -rln "V2Adapter" src` → 0; `src/legacy/engine-v3/*` (**9 файлов, вкл. 2 test**) удалить.
- **Frozen НЕ трогать:** `track.orchestrator.ts`,`patchV1.ts`,`AudioEngineV2.ts`,`src/bridges/**`. **live-guard НЕ moved** (остаётся в `bridges/`, импорт `main.tsx:6` легитимен, allowlist).
- **Гейт:** `grep -rln "V2Adapter" src` → 0; legacy удалён; canon GREEN.

### W5 — finalization (doc-debt BAC-111 + E1 cleanup)
- **Safe:** doc-terms; `__restoreV2Engine` → 0 (`grep -rn "__restoreV2Engine" src js` → 0); фасад ОСТАЁТСЯ (пограничный слой).
- **Гейт:** итоговый `grep -rlE "(import|from).*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src --include='*.ts*'` → 0 (комментарии = осознанный retain-класс, не блокер).

## 3. ФИНАЛЬНЫЙ ГЕЙТ (после W5)
```
npm run typecheck      # 306
npx vitest run          # 772
npm run verify:ci       # PARITY PASS
# dist/ не содержит V2-символы:
grep -rlE "AudioEngineV2|patchV1|track\.orchestrator|V2Adapter" dist 2>/dev/null || echo "CLEAN"
# SHA256 frozen совпал:
find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum > /tmp/frozen-post.sha
diff /tmp/frozen-pre.sha /tmp/frozen-post.sha && echo "FROZEN BYTE-IDENTICAL"
node team-m/bLb/frozen-guard.mjs   # 🟢 GREEN
```
Цепь верификации **001→002→009** (auto-гейты) → РЕШЕНО.

## 4. РОЛЛБЭК
- Flip: правка 1 константы `engine-mode.ts` (`'v3'`→`'v2'`).
- Волны: каждая свой коммит → откат коммитом волны.

## 5. ЗАМЕТКИ
- Все safe-файлы правятся Hub (PC, node). Мак — read-only дизайн.
- Критерий волн = `grep → 0`, а не точное число (расхождение V2Adapter 26/27 не блокирует).
- bLb / S3 / pitch — ОТЛОЖЕНЫ (post-m3), не в этом плейбуке.
