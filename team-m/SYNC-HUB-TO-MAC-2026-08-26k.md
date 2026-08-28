# ⚡ АКТУАЛЬНЫЙ БРИФИНГ · SYNC-HUB-TO-MAC · 2026-08-26k

> **СТАТУС:** единственный актуальный брифинг пред-M3-GO. Все `2026-08-25*` файлы перенесены в `team-m/archive/` (67 шт). Историч. цепочка `26a–26j` (Мак) + `26b/c/e/g/k` (Hub) — активны.

**Кому:** Mac (Задроты) — КОМАНДА МАКА, ПРОЧИТАТЬ ДО GO
**От:** Hub (007) · Винда-координация
**Тема:** Итог теста Босса на V3, корень питча, спек flip, вопросы к GO

---

## 1. VERIFIED ON V3 (из лога Босса + его слов)
| Зона | Результат |
|---|---|
| Boot / загрузка | ✅ без FOUC (BAC-001) |
| Playback / seek / lyrics / 6-stem | ✅ зелёный |
| Monitor-bridge (C26) | ✅ `[MONITOR-BRIDGE]` работает |
| **Mic-запись + Takes + отрисовка волны** | ✅ **РАБОТАЕТ** — Босс: «запись есть и тейки работают! задержки нет! волна рисуется!» |
| C27 (solo/mute) | ✅ ДА |
| C28 (индикатор V3) | ✅ console `[AETHER] ✅ HybridPipelineService Phase F — ACTIVE` (бейджа на экране нет — ок) |

→ **Этап 1 (микрофон-уши) gate = PASS.**

## 2. KNOWN ISSUES (не миграционные блокеры)
- **Quest-автоматизация:** сценарии ломаются в порядке следования («что за чем»). Босс: «это копейки». Отдельный мелкий баг, не блокирует flip.
- **Pitch НЕ работает на V3** — root cause ниже.

## 3. PITCH ROOT CAUSE (подтверждено в коде, не на слово)
`src/audio/pitch/pitch-engine.ts:46-52` `_getContext()`:
```ts
const ae = (window as any).audioEngine;          // V2-глобал
const ctx = (ae?.audioContext as AudioContext) ?? null;
if (!ctx) throw new Error('audioEngine.audioContext not found');
```
В V3 (No-Birth) `window.audioEngine` не создаётся → бросает. Плюс `initFromMic` (строка 65) читает `ae?.microphoneStream`.
Файл **SAFE** (не в frozen-листе). Чистый фикс = `PitchEngine` создаёт свой `AudioContext` + `getUserMedia` (fallback уже в строках 71-74). Это **решение A (OPT-IN pitch-connect)**.
Важно: питч уже сломан на V3 *сейчас* (в режиме VITE_ENGINE=v3). Flip дефолта его не регрессирует — он и так сломан. Вопрос только «фиксим до GO или после».

## 4. FLIP SPEC (готов, 1 коммит, frozen НЕ трогаем)
- `src/engine-mode.ts:5`: `(import.meta.env?.VITE_ENGINE as 'v2'|'v3'|undefined) ?? 'v2';` → `'v3'`
- `.env.example:23`: `VITE_ENGINE=v2` → `v3` (реконсил D2; `.env` уже `v3`, gitignored)
После flip: `npm run dev` → V3 по умолчанию; `VITE_ENGINE=v2` всё ещё даёт legacy.

## 5. VERIFICATION ГОТОВА (Hub)
- `team-m/bLb/frozen-guard.mjs` — 🟢 GREEN (5 ожидаемых BAC-105 в allowlist, проверено вручную)
- SHA256 frozen-baseline сохранён (`/tmp/opencode/frozen-baseline-sha.txt`)
- `team-m/bLb/boot-smoke.mjs` построен (Playwright + `VITE_ENGINE`) — нужен `npx playwright install chromium`
- Canon: tsc=306, vitest=772 passed

## 6. WAVE PACKS
- W1–W5 (Mac): FIXED per 009 (`f47568d`), применяемы. **Нужно обновить file-листы к живым счётчикам** (drift: delegateSync 21→23, V2Adapter 17→27, globals 12→9).
- S3-VIDEO (B, Student-Педагог B): спроектирован Маком (`413d8cc`), post-m3.
- B-slice (E5/E8): 009 дал GO на уровне доки; применение заблокировано грязной базой (неCommitted MonitorRouter/HPS у Мака). Нужен чистый коммит.

## 7. QUESTIONS TO MAC (для финализации GO)
1. **Wave-exec модель (GO #4):** один GO Босса покрывает W1–W5 (chain 001→002→009, авто-гейты) ИЛИ покомитное подтверждение? Hub рекомендует **один GO → chain**.
2. **PITCH OPT-IN (A):** авторизуешь pre-flip decouple `PitchEngine` от legacy `audioEngine` (MICRO-PACK-PITCH-CONNECT)? Или деферим post-m3 (питч остаётся сломанным, что и сейчас)?
3. **Quest-автоматизация:** Мак берёт фикс на себя или деферим? (мелкое)
4. **B-slice:** подтверди чистый коммит MonitorRouter/HPS, чтобы Hub мог применить post-flip.
5. **Блокеры:** есть ли новые на твоей стороне перед GO?

---
*Frozen untouched. Push CLOSED. M3-GO авторизован Боссом (условно на готовность; boot/playback/mic теперь верифицированы).*
