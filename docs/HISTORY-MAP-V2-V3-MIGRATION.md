# 🗺️ HISTORY-MAP — миграция beLive V2 → V3 (связь 007 ↔ Opus ↔ Sol ↔ Sonnet)

**Собран:** 007 · 2026-08-06
**Назначение:** единая карта истории — что происходило, кто кому передавал, что применено, что упущено, что ждёт Opus_5/Sol_5.
**Источники:** отчёты 007 в `beLive_Context` + отчёты архитекторов в `Downloads` + мега-пакеты.

---

## 1. Роли (кто есть кто)

| Роль | Кто | Владеет | Отчёты живут в |
|---|---|---|---|
| **007** | разведка/упаковка/координация | НЕ архитектурные решения | `beLive_Context/` (и `_ARCHIVE_007-REPORTS/`) |
| **Opus** | глобальные решения, roadmap, product | архитектура, GO/NO-GO | `Downloads/` (и `_ARCHIVE-ARCHITECT-REPORTS/`) |
| **Sol** | валидность evidence, veto на плохое доказательство | evidence gates | `Downloads/` |
| **Sonnet** | диагностика, harness-аудиты, S5 run | счётные/байтовые проверки | `Downloads/` + `beLive_Context/` |

**Правило потока:** Opus_5 решает → Sol_5 проверяет evidence → 007 исполняет. 007 никогда не объявляет causal verdict.

---

## 2. Нумерация — как читать связки

Отчёты **двусторонне нумерованы**:
- **007-отчёты** (в `beLive_Context`): `NNN-007-REPORT-FOR-SOL.md` / `MICRO-PACK-NNN.md`
- **Архитекторские** (в `Downloads`): `NNN-OPUS_4-...md` / `NNN-SOL_3-...md` / `NNN-HANDOFF-...md`

> 💡 **Правило:** номер `NNN` в обоих местах = **один и тот же шаг цикла**. 007 исполняет mandate от Opus → Opus/Sol отвечает отчётом → 007 закрывает. Полный круг = номер в Downloads (приказ) + номер в beLive_Context (исполнение).

---

## 3. ⏳ Хронология миграции V2 → V3 (по номерам)

### Фаза I — НАЧАЛО V3 (июль, ~051–084) — 🔒 АРХИВ
| # | Отчёт архитектора (Downloads) | Исполнение 007 (beLive_Context) | Событие / решение |
|---|---|---|---|
| 051–053 | OPUS2-FULL-PACKAGE, OPUS2-CODE-PACK | 053-MICRO-PACK-OPUS2 | V3 single-path, SoundTouch удалён |
| 054–059 | OPUS2_ диагноз, HANDOFF-007_ | MICRO-PACK-054–058 | прерывания MacBook, hot-switch TrackSession, duplicate-route checker |
| 061 | OPUS3-VERDICT: **Single-Path Engine (убить dual-backend)** | 061-FORENSIC-FLANGE | решение убить dual-backend → V3 единственный путь |
| 063–066 | OPUS3-FULL-PACK, разбор StretchInstance | 067-TEST-CARD | vendor DSP, StretchInstance, было-стало |
| 067–084 | OPUS5-VERDICT Gate 3B BLOCKED 25-30 | MICRO-PACK-071–084 | **Gate 3B BLOCKED** — главный блокер фазы, impulse-тесты vendor silent |
| 085–094 | v6.25/6.26 verdicts | MICRO-PACK-080–084, рекон потоки B/C | vendor audit latency, CPU baseline, H5-STFT |

**Ключевые находки фазы I:**
- ✅ SoundTouch удалён, V3 single-path прошёл smoke
- ✅ WASM crash устранён (AGENT_202_WASM_CRASH_BRIEF)
- ❌ **Gate 3B BLOCKED** (25-30) — не закрыт по чистому smoke
- 💡 Идея: **Single-Path Engine** (064) — V2 dual-backend упразднён

### Фаза II — SOL_2/SOL_3, evidence-first (02–04 августа, ~095–140) — 🔒 ЧАСТИЧНО АРХИВ
| # | Отчёт архитектора (Downloads) | Исполнение 007 (beLive_Context) | Событие / решение |
|---|---|---|---|
| 095–098 | OPUS5-VERDICT, FINAL-ROADMAP-v3, COORDINATION-MAP | MICRO-PACK-084–098 | **evidence-first миграция** объявлена главным принципом |
| 099–112 | HANDOFF SOL_1→SOL_2, OPUS5-AMENDMENTS | 099–112 отчёты SOL_2 | harness v6.26, Phase-эксперимент D1, preregistration |
| 113–122 | v6.30/6.31/6.32 runs | 113–122 отчёты | positive-control, Gate 3B rerun, V6.32.2 |
| 123–124 | **HANDOFF-OPUS_4** (global authority) | 123-HANDOFF-SOL_3-FULL-PACK (4.1MB!) | **смена ролей**: Opus_4 глобальный, Sol_3 gatekeeper, 007 execution |
| 125–127 | OPUS_4-ROADMAP-REVIEW, SOL_3-BRIEFING | — | решения D-001…D-010 |
| 129–133 | SOL_3-W2-DECISION, OPUS_4-W2-VERDICT | 132–133 EXECUTION-CARD | W2 verdict: signature decoded_ +570, **W3 audit** |
| 135–140 | SOL_3-DECISION W3, c44 INVALID, r2 c44→c128 | 134–140 | **c44 INVALID** (harness), r2 static verified |

**Ключевые находки фазы II:**
- ✅ Evidence-first подход принят
- ✅ W2: signature `decoded_` +570 vs -clickLen
- ❌ **c44 INVALID** — harness баг, повторный GO-контур
- 💡 Идея: D-WriteBoundary prereg (129)

### Фаза III — SOL_4, W4, H13 (04–05 августа, ~140–161) — 🟢 В КОРНЕ
| # | Отчёт архитектора (Downloads) | Исполнение 007 (beLive_Context) | Событие / решение |
|---|---|---|---|
| 142–144 | OPUS_4-DECISION: r2 валиден, SSO не исчез | 143-007-W4-EXECUTION-CARD | **W4 signature mapping** начат; Sonnet в команде |
| 145–148 | SCOUT-SUPPORT-CARD, HANDOFF-SOL_4 | 145–148 | Scout-цифры сверены, **два пакета**: PACKAGE-A (map) + PACKAGE-B (evidence) |
| 149–154 | — | 149-PACKAGE-A-SOL4-MAP, 150-PACKAGE-B-SOL4-EVIDENCE (6.8MB!), 151–154 | H14 audit, WASM-артефакт, final reconciliation |
| 155–161 | OPUS_4-FINAL-SOL4-REVIEW, SOL4-ROADMAP | 156-SOL4-ALL-IN-ONE (1.7MB), 161-verification | **V3 evidence verdict** — ключевой рубеж |

**Ключевые находки фазы III:**
- ✅ W4: r2 signature mapping доказан, SSO-candidate=0
- ✅ H14 был подтверждён → затем **INCONCLUSIVE** (переоценён)
- ⚠️ Идея «H13-B checkpoint/Blob» — выдвинута, но не доказана
- 💡 Идея: Scout-канал (рекон цифр по точным формулам)

### Фаза IV — H13-S5, S5 proven (06 августа, ~162–185) — 🟢 В КОРНЕ
| # | Отчёт архитектора (Downloads) | Исполнение 007 (beLive_Context) | Событие / решение |
|---|---|---|---|
| 162–164 | SOL4-ROUTE-DECISION, OPUS_4-DECISION | 164-TIMESTAMP-AUDIT-CARD | H13 association, **timestamp audit before any run** |
| 165–170 | — | 165-007-TIMESTAMP-AUDIT-FINAL, H13-S5-EXECUTIVE | timestamp archaeology **закрыта** (branch closed) |
| 171–173 | SONNET-CONTEXT-AND-TASK, OPUS-4-ROUTE-DECISION | 172-ARCHITECTURE-DESIGN-REGISTER, 173-SONNET-SHA-DIVERGENCE | **SHA divergence**: 63-char r2 = erratum, активный 64-char |
| 174–177 | OPUS_4-SOL4-MAP, SHA canonical fix | 175/177-007-REPORT | **canonical SHA** утверждён, H13-B dormant |
| 178–182 | OPUS_4-ROADMAP, SOL4-DEEP-REVIEW | 181-S5-EVIDENCE-PACKAGE | **S5 PROVEN** (байт-в-байт classifier equivalence) |
| 183–184 | OPUS_4-ROUTE-MAP, **MANDATE 184** | 184-007-REPORT | 24-bit аудит, V3 commit boundary, P1/P2 cards |
| **185** | OPUS_4-HANDOFF-PACK (состав мегапакета) | **185-007-REPORT-FOR-SOL5** + **185-OPUS5-SOL5-MEGA-PACK.md** (5.1MB) | 📦 **МЕГАПАКЕТ ГОТОВ**; добавлены 184C (N1-N5 тесты) + ДОПОЛНЕНИЕ-5/185D (Residua architecture-2.2, REFERENCE ONLY, SHA `43228c1a...`) |
| **186–188** | **HANDOFF-OPUS_5**, **HANDOFF-SOL_5**, **ENGINE-SOURCE-PACK** | `ENGINE-SOURCE-PACK-OPUS5.md` (1.5MB) | 🚀 **ПЕРЕДАЧА Opus_5/Sol_5** |

**Ключевые находки фазы IV:**
- ✅ **S5 PROVEN** — главное достижение: derived-path classifier equivalence байт-в-байт
- ✅ **Canonical SHA** утверждён (erratum 63-char зафиксирован)
- ✅ Timestamp-ветка закрыта
- ✅ **MEGA-PACK 185 готов** — 112 записей, 8/8 acceptance gates PASS
- ❌ H13-B / H14 **INCONCLUSIVE** (dormant)
- ❌ Gate 3B **BLOCKED**, Gate 4a **NOT RUN**, production **NO-GO**

---

## 4. 📦 Мега-пакеты (что ждёт Opus_5/Sol_5)

| Пакет | Файл | Размер | Роль |
|---|---|---|---|
| **MEGA-PACK** | `185-OPUS5-SOL5-MEGA-PACK.md` | 5.1 MB | evidence + roadmap + architecture, 112+ записей, 8/8 gates PASS, блоки 184C + 185D (Residua architecture-2.2) |
| **ENGINE-SOURCE** | `ENGINE-SOURCE-PACK-OPUS5.md` | 1.5 MB | полный V2→V3 runtime код (манифест 188 = требование к сборке) |
| **007-REPORT** | `185-007-REPORT-FOR-SOL5.md` | 4 KB | финальный отчёт 007 по mandate 185 |

**186-HANDOFF-OPUS_5** и **187-HANDOFF-SOL_5** в Downloads — инструкции для новых ролей, ссылаются на MEGA-PACK (SHA `515b0b25...` в Downloads; контейнер пересобран — фактический SHA `311e6455...` в beLive_Context после gap-fix). **188** — требование к engine-source сборке.

---

## 5. 🧭 Что применено vs что упущено (честный баланс)

### ✅ ПРИМЕНЕНО (стало кодом/фактом)
| Идея/решение | Кем | Где реализовано |
|---|---|---|
| SoundTouch удалён | Opus_2 | V3 single-path |
| Single-Path Engine (убить dual-backend) | Opus_3 (064) | V3 единственный путь |
| WASM crash устранён | 007/Sonnet | vendor load |
| S5 classifier equivalence | Sol_4/Sonnet/007 | доказано байт-в-байт (PROVEN) |
| Canonical SHA (64-char) | Sol_4 (180) | SHA rule |
| 47 V3-файлов закоммичено в `29e2c5ef` | ранее | `src/audio/engine-v3/**` |

### ❌ УПУЩЕНО / НЕ ДОКАЗАНО (открыто)
| Вопрос | Статус | Что нужно |
|---|---|---|
| **24-bit decode** ломается | AUDIT done, **RUN PENDING** | прогон reproducer в браузере |
| **H13-B** checkpoint/Blob пауза | **INCONCLUSIVE** | новый измеряемый артефакт |
| **H14** input silence | **INCONCLUSIVE** | докажи/закрой |
| **Gate 3B** | **BLOCKED** | не закрывать по smoke |
| **Gate 4a** | **NOT RUN** | после Gate 2 |
| **Gate 2** | **INCOMPLETE** | dropout positive-control дизайн есть |
| **P1 (V3 default)** | DESIGNED | production switch = HOLD |
| **P2 (instrumental policy)** | DESIGNED | ждёт приказа |
| **V2/Legacy удаление** | INVENTORY | каждый блок отдельное решение |
| **N1–N5 контракты** | DESIGN ONLY | довести до acceptance |
| **141-OPUS-BRIEFING** | **MISSING** | запись в манифесте + OQ-10 |

### 💡 ИДЕИ (которые были, но возможно упущены — проверить Opus_5)
1. **D-WriteBoundary prereg** (129) — пререгистрация границы записи — оформлена, не исполнена
2. **Scout-канал** (145–146) — независимая сверка цифр — работал, закрыт после S5
3. **Test-stream дизайн** (184, V3-TEST-STREAM-CARD) — play/seek/16-24bit/cold-warm — **RUN HOLD**
4. **CPU/RAM budget contract** (N4) — дизайн есть, измерений нет
5. **Bluetooth jitter protocol** (N5) — дизайн есть, прогонов нет
6. **24-bit fixtures** (188, требование) — PCM fixtures нужны для decode-тестов
7. **Gate 2 dropout positive-control** — дизайн упомянут, тест не собран

---

## 6. 🚦 Текущий статус (2026-08-06, вечер)

```
V3 engine        ✅ single-path функционален, smoke пройден, 47 файлов в HEAD 29e2c5ef
S5               ✅ PROVEN
H13-A            🟡 SUPPORTED (diagnostic-only)
H13-B / H14      🔴 INCONCLUSIVE (dormant)
Gate 3B          🔴 BLOCKED
Gate 4a          ⚪ NOT RUN
production       ⛔ NO-GO
N1–N5            📝 DESIGN ONLY
24-bit           🔬 AUDIT done, RUN PENDING
MEGA-PACK 185    📦 ГОТОВ (8/8 gates)
ENGINE-SOURCE    📦 ГОТОВ (манифест 188 → `ENGINE-SOURCE-PACK-OPUS5.md`)
Opus_5 / Sol_5   🚀 ЖДУТ (186/187 handoff в Downloads)
007              🧊 STANDBY — не принимает архитектурных решений, не запускает
```

**Следующие шаги (за Opus_5/Sol_5, вопросы OQ-1…OQ-12 из мегапакета):**
1. V3 commit boundary — что именно входит + rollback tag
2. 24-bit — точная граница decode, где ломается
3. P1 (V3 default) + P2 (instrumental) — условия перехода
4. N1–N5 контракты — довести до acceptance
5. P0 gates → только потом REGIME 0 и удаление V2 boundaries

---

## 7. 📂 Карта архивов (куда что уехало)

| Место | Архив | Что внутри |
|---|---|---|
| `beLive_Context/_ARCHIVE_007-REPORTS/` | 252 файла | отчёты 007 до 03.08 (фазы I–II), июльские пакеты |
| `Downloads/_ARCHIVE-ARCHITECT-REPORTS/` | 31 файл | отчёты архитекторов до 03.08 (053–100, дорожные карты V3) |

**Осталось в корне beLive_Context (95 файлов):** отчёты Aug 3–6 (фазы III–IV), 3 protected (`000-FULL-BASE.md`, `_007-SPEC-STATUS.md`, `_007-state.md`), 3 мега-пакета (185, ENGINE, 185-report), пакеты >3MB (123, 150, Logs.md).
**Осталось в Downloads (55 md):** отчёты архитекторов Aug 3–6 (123–188), системные (AGENTS.md, SKILL.md, beLive_PRD.md, slot-matrix-system-v2.2.md).

> ⚠️ Файлы >3MB (123-HANDOFF 4.1MB, 150-EVIDENCE 6.8MB, Logs.md 7.7MB, 156-ALL-IN-ONE 1.7MB) — НЕ тронуты, ждут разбора.
> ❄️ Frozen-зоны (AudioEngineV2, patchV1, bridges, track.orchestrator) — не тронуты, OVERRIDE не было.

---

*Карта составлена 007 · 2026-08-06. Обновлять при каждом новом mandate/отчёте. Связка номеров: Downloads=приказ, beLive_Context=исполнение, мега-пакет=результат.*
