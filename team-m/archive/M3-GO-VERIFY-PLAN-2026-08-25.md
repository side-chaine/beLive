# M3-GO VERIFICATION PLAN · read-only · 2026-08-25 · агент: 009

**Источники:** PLAN §2–§3 · PARITY-LEDGER · REGISTRY · repo recon. Только верификация, код не трогаю.

## 0. Канон (базовая линия §2)
| Item | Canon | Check | Regression |
|---|---|---|---|
| tsc | **313** | `npx tsc --noEmit` total=313 ∧ set-diff vs `scripts/known-ts-errors.txt`=∅ | новая ошибка вне known = FAIL даже если ≤313 |
| vitest | **769** (2 legacy missing-import вне счёта) | `npx vitest run` passed=769; исключённые имена названы в отчёте | новый fail / рост exclude = FAIL |
| Форма отчёта | A4: «tsc N / vitest passed M, files X/Y, Z legacy load-error» | каждый гейт | смешение статусов = drift |
| Статусы | написано ≠ подключено ≠ подтверждено ушами | каждый ✅ с тегом | untagged ✅ = не принято |

**Read-time дельты (входы, не вердикты):**
- **D1:** default engine site `src/App.tsx:93` (`?? 'v2'`), план пишет `:88`. Шаг-13 ищем по grep `VITE_ENGINE`, не по номеру строки.
- **D2:** `.env:5` сейчас `VITE_ENGINE='v3'`, `.env.example:23` = `v2`. Pre-flip состояние противоречиво → реконсилировать с PC HEAD до flip-коммита.
- **D3:** `scripts/known-ts-errors.txt` = 144 строки vs canon 313 → partial ledger; критерий остаётся count=313 ∧ set-diff=∅.
- **D4:** `js/audio-facade-v3.js` сегодня НЕТ accessors / пустые volume-stub (:33) — B-slice цели подтверждённо отсутствуют.
- **D5:** `COMMITS-REGISTRY` / TSC-ledger не найдены glob — запинить пути (Hub) ДО шага 17.

## 1. Матрица 18 шагов (уровень / команды / FROZEN-метод)
Легенда: 🟡 static · 🟢 CDP · ✅ ears. FROZEN-колонка = МЕТОД + non-frozen доказательство, никогда «FROZEN-OK».

| # | Step | Level | Commands/checks | FROZEN method + non-frozen proof |
|---|---|---|---|---|
| 1 | Бандл-сессия ✅ | 🟡 | артефакт сессии vs шаблон; неполный пункт ⇒ не принято | n/a; если бандл ревью: `git diff HEAD --stat` = 0 изменений в frozen зонах |
| 2 | solo/mute-инвариант ✅ уши (C27) | ✅+🟢 | ears-log в PARITY-LEDGER; C27 discriminator meter/(input×RAW-volume) | через non-frozen gain-chain: stem-reactive.ts:92-93 + practice-session.store слушатели; vitest pin-semantics ×6 (54e2847) green → frozen поведение на stop/restore неизменно |
| 3 | Индикация обоих режимов ✅ уши (C28) | ✅+🟢 | ears + CDP: indicator == resolved engineMode | predicate display читает published flag `main.tsx:132/150`; single-writer (шаг5) |
| 4 | Mic-уши ✅ (§5) | ✅ | полный список §5; **предусловие: B-slice + F-2-дубль закрыты** | volume-path ears через non-frozen фасад-члены ПОСЛЕ B-slice (в js/audio-facade-v3.js, не stub) + гард |
| 5 | E1-канонизация ✅ | 🟡 | `grep -rn "__v3Active\|isV3Active\|isV3Master" src/` → ровно 1 writer (main.tsx:150); инвентарь loop-events×3, 389-G1..G4, A-G5/G6, MixerPanel, 8+ readers :373 | frozen потребляет predicate только через published window flag; non-frozen reader main.tsx:279 ведёт себя идентично; vitest interceptor green |
| 6 | E2 ✅ (v3-конфиг CDP) | 🟢 | CDP V3+V4: emission в ОБА режима; dedup; fallback-string present | parity через non-frozen publisher: V3StatePublisher эмитит 'loopcompleted'; legacy-emission в frozen доказывается через shared consumers practice-session.store:184-189 + sync.ts:11 + facade.ts:45 |
| 7 | E3 ✅ (фасад + rehearsal) | 🟢+🟡 | boot smoke v3-config live, метры живые (417) CDP V5; 4 члена alive пост-B-slice; rehearsal record | фасад revival ТОЛЬКО в js/audio-facade-v3.js (non-frozen); гард `__v3Active` → cage не глушит; `git diff` frozen зон = пусто |
| 8 | Practice-gate ✅ (749/749) | 🟡 | vitest 769; mock-drift fix через test diff (Proof-of-change) | practice store слушает 'loopcompleted' non-frozen — suite green доказывает frozen contract intact |
| 9 | Cut-list из E4-A | 🟡 | cut-list atomic + greppable; 0 wildcard; каждый cut → dist-inventory class | pre-cut SHA256 frozen зон + vendor WASM; re-hash при execute = identical; non-frozen callers re-point в том же pack (tsc 313) |
| 10 | M3-VERIFY dist-grep (шаг0=инвентарь) | 🟡 | **Positive FIRST:** `rg -l getStemMeterLevel`, `'loopcompleted'`, `'audioglitch'` ≥1; **Negative:** `esbuild`=0, `mangle-props`=0; шаг0: классификация dist/** {чанк/статик-M3/known-retained-M5}; fallback ladder sourcemap→модуль-граф→дельта | meter provenance: HybridPipelineService.ts:559 + IV2PublicContract.ts:92 (через public contract only); stem-id set = 6 из stemTypes.ts |
| 11 | FALLBACK-VERIFY CDP V1–V10 + уши | 🟢+✅ | последовательность V1–V10; ears-lines: orchestrator plays, vocalHall по карте, **метры=0 ожидаемы**, предикаты | playback-through-orchestration НАБЛЮДАЕМО (currentTime advances + RMS>0); regression net = pin-semantics ×6 + takes suites; 0 reads/writes frozen |
| 12 | Ретир V2-recovery MICRO-PACK поимённо | 🟡 | имена веток («V2-recovery-ветки», НЕ «fallback»); `rg -i wildcard`=0; двойная сверка терминов | каждый retired diff: intersect frozen zones = ∅; выжившее поведение через non-frozen suites green |
| 13 | Флип VITE_ENGINE ×3 | 🟡+🟢 | ОДИН коммит, ровно 3 сайта: `.env`,`.env.example`,App.tsx engine (grep VITE_ENGINE; D1 :93); D2 реконсилировать до; post-flip CDP V1 green | flip меняет selection flag; frozen behaviour идентично в обеих позициях → CDP V5/V6 в ОБЕИХ позициях diff outputs (parity) |
| 14 | Dual-tag pre-M3=П-12; pre-M5=repo-rollback | 🟡+🟢 | pre-M3: worktree→build→boot→discard, boot=CDP V1+V5; discard pristine; pre-M5: dry-run pointer | build в throwaway worktree доказывает frozen compiles unmodified: bundle hash frozen-origin chunks equal |
| 15 | П-8 зафиксирован | 🟡 | LATENCY-REGISTRY entry с delta-line (F5); fingerprint fields §6 | замеры через non-frozen hooks (bus wrappers, publisher tick 50ms); методология §E |
| 16 | 0 новых tsc | 🟡 | tsc 313 ∧ set-diff known=∅ | type surface frozen unchanged; координатный сдвиг known frozen error = silent frozen edit → STOP |
| 17 | TSC-ledger запись | 🟡 | entry A4-form; linked gate ID (D5 path pin) | ledger снапшот frozen-error координат |
| 18 | Канон терминов | 🟡 | V2-recovery (умирает M3) / V3-fallback (переживает M3+M5); `rg -in fallback` по step9/12 = 0 misuse | термины мапятся без naming frozen: routing через frozen + умирает M3 = recovery; non-frozen facade/pipeline выживает = fallback |

## 2. CDP V1–V10 (шаг 11; реюз в 6/7/13/14)
Runner: Playwright CDP (`@playwright/test ^1.60.0`) или `chrome --remote-debugging-port` + Runtime.evaluate.
| V | Probe | Pass |
|---|---|---|
| V1 Boot | resolve engineMode; `!!window.__belive.pipeline` | mode ok; pipeline present |
| V2 Predicates | sample `__v3Active` до/после switch | consistent; single writer (console mutate reverts) |
| V3 Emission оба режима | instrument event-bus; track-load v3 И fallback | emission в обоих; fallback-string present |
| V4 Dedup | count per cycle | ровно 1; dup = FAIL |
| V5 Meters alive (v3) | poll getStemMeterLevel ids∈{instrumental,vocals,drums,bass,backing,other} | ≥1 >0; bridge cache ticking |
| V6 Loop events | force wrap | `loopcompleted` CustomEvent {previousTime,newTime,loopStart,loopEnd}; bus relay |
| V7 Glitch health | listener `audioglitch` | wired; 0 spurious в healthy |
| V8 Fallback drive | fallback play | currentTime advances; vocalHall по карте; audible |
| V9 Fallback meters | poll как V5 | **метры=0 ожидаемы** (stub return 0) |
| V10 Indicator+solo/mute | cross-mode | C27 holds; C28 correct |

## 3. ⛔-gate → acceptance evidence
| Gate | Evidence |
|---|---|
| G-A Sweep-group коммиты | isolated commit; tsc313/vitest769 attached; ⛔-report; frozen-intersect diff = ∅ |
| G-B M3-VERIFY (10) | positive BEFORE negative; negative=0; шаг0 inventory table; fallback ladder documented |
| G-C FALLBACK-VERIFY (11) | CDP V1–V10 log; ears-lines; no frozen inspection |
| G-D Flip-коммит (13) | single commit ровно 3 сайта; D2 reconciled; post-flip CDP V1 green |
| G-E Canon (16–17) | tsc=313∧diff=∅∧vitest=769; A4 ledger |
| G-F COMMITS-REGISTRY (на каждом ⛔) | every commit cited has row (D5 pin first) |
| G-G Ц3 audit conditions (норма Ц3-1) | each ⛔-report lists attached Ц3 Q с disposition |
| G-H Push/деплой 🔒 | LOCKED; любое упоминание push = STOP |
| G-I Mic-ears scheduling (§5) | ONLY after B-slice + F-2-дубль (PARITY-LEDGER пока только TASK-015; B-slice entry absent = «НЕ НАЧАТ») |

## 4. Вердикт гейткипера
План исполним как есть, когда D5 (registry paths) запинён и D2 (env vs PC HEAD) реконсилирован Hub-ом — оба входы, не блокеры планирования. Каждый ряд Table 1 должен достичь evidence до закрытия соотв. ⛔. Tripwires: «поправить frozen» = STOP; новая TS ошибка вне known = regression; статус-смешение = drift.

— 009 · read-only · awaiting dispatch
