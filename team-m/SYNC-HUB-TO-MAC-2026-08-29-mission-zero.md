# SYNC → MAC: MISSION ZERO (Hy4) VERIFIED + твой GO на параллельный аудит

**От:** 007 (Linux / Hub) · **Дата:** 2026-08-29 · **Кому:** 007_Мак
**Канал:** репо — `REGISTRY.md` §7 (Mac-side #4) + это письмо + `docs/modernization/handoff/`

---

## 1. Что случилось
Hy4 (Кай, Windows-агент) провёл ночной аудит и выбрал **MISSION ZERO** — модернизацию
(типы, CI, гейты, документация). Legacy он **НЕ трогал**. Результат верифицирован мной
(Linux-007) на 100%:

- **Frozen ЧИСТ.** `verify-frozen.mjs` на моём `main` → ✅ **21 path(s), 0 modified**
  (git blob SHA-1, сопоставимо между машинами). Старая «дивергенция» `efa6fde0` (мой git-blob)
  vs `c5311543` (sha256 Hy4) = **разные хэш-алгоритмы, не байты**. Ложная тревога закрыта.
- **Код компилируется.** В worktree (base + `V2AudioCage` из моста) tsc **296 → 216 (−80)**,
  целевые файлы Hy4 (`V2Adapter` / `V2AudioCage` / `V2ResurrectionDetector` / `CaptureWorklet` /
  `audio-worklet-global.d.ts`) = **0 ошибок**.
  - **FINDING-001** — `V2ResurrectionDetector` молча врал (require в ESM, неверный путь,
    чтение несуществующего `getState()`) → заменён **наблюдателем** на `V2Adapter`
    (естественный choke-point, «единственный файл, читающий V2»). Без require / monkey-patch.
  - **FINDING-002** — 80 ошибок `CaptureWorklet` одним `audio-worklet-global.d.ts`
    (ambient, **стирается при сборке → ноль рантайм-риска**).
- **SRI-PATCH готов** — 9 MediaPipe-скриптов + `integrity="sha384"` + пин версий → блок для
  `index.html` строки 26–34 (файл Босса, аккуратно не трогать).

## 2. Где материалы (читай ПЕРЕД стартом)
Весь handoff Hy4 **персистнут в репу** (git-tracked — заберёшь `pull`-ом):
`docs/modernization/handoff/`
- `00-README-007.md` — входное чтение
- `01-CODE-CHANGES.patch`, `02-CONFIG-CHANGES.patch`, `errors-212.txt`
- `docs/` — REGISTRY, 15 ADR (0001–0015), FINDING-001/002, SRI-PATCH,
  MISSION-ZERO-REPO-SCAN, 01-BASELINE, 00-ROADMAP
- `verify-frozen.mjs` + `mission-zero.bundle`

**Порядок чтения:** `00-README-007.md` → `docs/REGISTRY.md` → `docs/01-BASELINE.md` →
`docs/MISSION-ZERO-REPO-SCAN.md` → ADR-0001…0015 → FINDING-001/002 → SRI-PATCH.

## 3. ТВОЙ GO — параллельный Hy4-стайл аудит
Босс: *«пусть Мак тоже начнёт проводить исследования Hy4»*. Делай **независимый аудит**
в том же духе, покрывая проблемы, которые Hy4 НЕ трогал. Выбери СЛОЖНУЮ задачу
(по духу Hy4 — он брал «самую сложную»). Кандидаты (из его ADR/REGISTRY, ещё не закрытые):

| Кандидат | Суть | Источник |
|---|---|---|
| **ADR-0013** CI-gate architecture | ratchet-гейты вместо выключателей; ESLint→TypeScript (541 `as any` = гейт, не чистка) | docs/ADR-0013 |
| **ADR-0009** test strategy | §3.1: компонентных тестов НОЛЬ; покрытие падает | docs/ADR-0009 |
| **BAC-109** console-гигиена | ~363 `console.*` вне `import.meta.env.DEV`; логгер-политика ADR-0007 | REGISTRY §7-23 |
| **ADR-0012** dependency-manifest | 86→~23 devDeps; «44 мажора» = ложь, реально 7 | docs/ADR-0012 |
| **ADR-0008 / SRI-PATCH** | CSP + SRI; хэши готовы, нужен `check-sri` гейт в CI | docs/ADR-0008, SRI-PATCH |
| **ADR-0014 / ADR-0010** | monorepo layout; node_modules integrity (никогда не синхронизировать) | docs/ADR-0014/0010 |

Формат как у Hy4: разведка → stress (002) → boost (005) → verify+doc (009).
Результат клади в `team-m/reports/mac-007/` + статус в `REGISTRY.md` §7 (Mac-side).

## 4. ЖЁСТКОЕ ПРАВИЛО (как у Hy4)
**FROZEN-зона НЕ ТРОГАТЬ:** `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`,
`src/bridges/*`, `src/services/track.orchestrator.ts`. Любое упоминание этих файлов в твоём
отчёте = **СТОП-эскалация Боссу**, не самостоятельное решение. Аудит = чтение + доки +
внешние фиксы (конфиги, CI, новые файлы вне frozen). Наткнёшься на баг в frozen — опиши,
но правку только по явному OVERRIDE Босса.

## 5. Мост (для справки)
`/mnt/c/Users/nikit/beLive-bridge/{from-windows,to-windows}` — WSL-мост Windows↔Linux.
Мак его НЕ видит (отдельная машина по LAN); для тебя канал = репо (pull).
Запусти `verify-frozen.mjs` у себя, сверь вывод с моим (21 path CLEAN) посимвольно.

---
*Отправлено Linux-007 как Hub-координатор. Жду ack + первый recon-отчёт в REGISTRY §7.*
