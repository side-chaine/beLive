# FORWARD HORIZON · что после M3 · 2026-08-25 · агент: explore (read-only)

Источники: PLAN §0–§8, REGISTRY, WEB-CHAIN-PACK, ROADMAP-FULL-LIGHT, M3-GO-VERIFY-PLAN, E1-PREDICATE-INVENTORY, 425-G0-DRAFT, LATENCY-REGISTRY, SYSTEM-REPORT-V007, BUFFER-CENTER3. frozen — «frozen audio-core, read-only per protocol».

## 1. M5 — что переживает M3
- Терм-канон (§3.18): V2-recovery умирает M3; V3-fallback/varispeed переживает M3+M5. FALLBACK-VERIFY (row 11) пинит: orchestrator-driven playback, vocalHall по карте, meters=0, predicates.
- dist-retention (M3-VERIFY row 10): инвентарь dist/** → {чанк/статик-M3/known-retained-M5}; класс known-retained-M5 заполняется ВО ВРЕМЯ M3, M5 наследует машинно-грепаемый список.
- Dual-tag (row 14): pre-M3 = П-12 worktree→build→boot→discard; pre-M5 = repo-rollback (dry-run pointer при M3, реальный anchor для M5).
- E1 «умирает на M5» колонка: большинство expiry на M3; M5-колонка ещё не заполнена — само по себе незакрытая M5-работа.
- M5-специфика НЕ начата (в репо нет M5-спека): cut против known-retained-M5, реальный repo-rollback, survivor-аудит, популяция E1-колонки, M5 ⛔-гейт-структура (аналог G-A..G-I) — не существует.

## 2. E7 — определение + цепь
- PLAN §0 goal 4 = «Push и деплой на прод»; единственный goal без привязки к другому milestone.
- LATENCY-REGISTRY — «single source of truth for E7 dual-rate» (baseLatency@44.1/@48k = TBD замер); вопрос G: фактические baseLatency×rate — замер в живой сессии.
- FINAL-JSON/мак (№1) + TR-07/PT-01/PT-02 (dual-rate spec) статус ⚠️ «живой прогон не проводился».
- Inference: E7 = терминальная E-фаза, несущая goal 4 (push/deploy) + FINAL-JSON/dual-rate closure (live baseLatency×rate, TR-07/PT-01/PT-02).
- Цепь: M3-GO(18/18) → M5(retained dist retired, rollback anchor) → GO green → E7(FINAL-JSON/dual-rate + push/deploy).

## 3. GO-условия (зелёные гейты)
1. Legacy V2 уделён из бандла (dist-grep negative + E4-A cut-list + V2-recovery retired поимённо, 0 wildcard). Gate 3B закрыт по preregistration (§0: НЕ смешивается с удалением V2).
2. M3-GO 18 rows ✅ на заявленных уровнях (C27/C28 уши, mic-сессия за B-slice+F-2, E1 canon, E2 emission, E3 facade+rehearsal, practice-gate, FALLBACK-VERIFY V1–V10, flip ×3, dual-tag, П-8, 0 tsc, TSC-ledger, term-canon).
3. ⛔-гейты G-A..G-I закрыты с evidence; G-F COMMITS-REGISTRY cross-check; G-G Ц3-вопросы; G-H push LOCKED; G-I mic-сессия scheduling.
4. Gate 3B кампания завершена (старт = подпись №4; thresholds из G1; budget; 5-й исход).
5. Подписи: №4 (СРОЧНОСТЬ↑, longest latency), №1 opportunistic, №7 M4→M3, №8 budget fixed, №16 в M3-GO, №17/№18 DECIDED.
6. Канон 313/769, A4, proof-of-change для race/async.

## 4. Gate 3B кампания — последовательность
- Не стартовала; старт = подпись №4.
- Пайплайн: G0 pilot → G0.5 (runner plumbing) → G1 baseline → thresholds → G2/G3.
- Runner unattended (.mjs, Chrome headless WSL), E/X endpoints, warmup≥1.5s ×≥2, T_sus≥2W, per-rate X, ε_floor removed, G4 discriminator, duck-invariant, storm, blind-zone→G5, watchdog N/A.
- Блокеры: №4; ревью Ц3+Ц2 G0-draft; E/X URL (вопрос 1 draft); fingerprint-flip = новая кампания.
- 5-й исход: «bounded out-of-envelope closure» (X-collapse + clean E = positive closure с boundary; НЕ test result; rerun только при X-collapse). «inconclusive» banned. Budget 112/120/≤8; escalation СТОП+Ц3.

## 5. Push/Deploy gating
Push/деплой 🔒 (PLAN §2, G-H: «LOCKED; любое упоминание push = STOP»). Блок до полной V3-миграции локально доказанной. Исключение — backup-ветка `backup/win-V3-finish_2-2026-08-23` (перед backup-push — secrets-scan обязателен). Unlock = GO от Boss/Ц3, требует goals 1–3 + M3/M5 chains.

## 6. Forward sequence
```
[B-slice]→[F-2 дубль]→[mic-уши]→[425+G4 spec]→M3-GO(18, dual-tag, flip, cut-list)
E: M3(flip default; V2-recovery dies; dist inventory→known-retained-M5)
   →M5(retire retained; real rollback anchor; survivor audit)
   →GO(all §3 gates+signatures)→E7(FINAL-JSON/dual-rate; push/deploy)→prod
G: signature №4→Gate3B campaign (G0→G0.5→G1→thresholds→G2/G3; 112/120/≤8)
   → закрыта ДО GO (goal2≠goal1)
```
Open questions for Ц3: M5-spec owner; E7 body confirm; Gate3B E/X URLs; timing №4; verify-plan deltas D2(.env) и D5(COMMITS/TSC-ledger paths pin); unresolved E1 literals 389-G1..G4 / :373 и C28 +1 site.

— explore · read-only
