# 🧾 CLOSURE-ТАБЛИЦА M3-GO · 18 строк (PLAN §3) · Ц3 4.2.2
> От: 007_Мак · 2026-08-28 · DRAFT v1 (на ратификацию Hub/Вёдра)
> Формат per SYNC-HUB-TO-MAC-2026-08-26r.md:44: `строка M3 | что закрыто (где/коммит) | что открыто → какая волна закрывает`.
> Источники: docs/PLAN-v3.3-CANONICAL.md §3(:53-69)/§5/§8(:116-120); REGISTRY.md:32; WAVE-PREFLIP-BASELINE; MICRO-PACK-WAVE3/4/5; PARITY-LEDGER; archive/M3-GO-VERIFY-PLAN-2026-08-25.
> ⚠️ Ограничения Мака: нет node → tsc/vitest/CDP не гоняю; «уши» = сессии Босса. Такие строки помечены [verify-PC]/[уши-Босс].

| № | Строка M3-GO (PLAN §3) | Статус | Что закрыто · evidence | Что открыто → кто закрывает |
|---|---|---|---|---|
| 1 | Бандл-сессия | ✅ | закрыто ранее (bundle-session, журнал PLAN §8) [verify-PC] | — |
| 2 | solo/mute-инвариант, уши (C27) | ✅ уши | C27 ears (PARITY-LEDGER; effectiveGain на stretchGain) [уши-Босс] | — |
| 3 | Индикация обоих режимов, уши (C28) | ✅ уши | C28 ears (PARITY-LEDGER) [уши-Босс] | — |
| 4 | Mic-уши (§5) | 🟡 частично | ушами: v-Mix, №17, №18 (PLAN §5) [уши-Босс] | остаток (solo-превью/vocal-fade/автопауза/RTL/П-8№2/TRIM-BASIS/B-slice×3/F-2-дубль) → **mic-уши-сессия между W3 и W4** |
| 5 | E1-канонизация | ✅ | E1 применён: single-writer `main.tsx:148 __setV3Active`, 28 sites (Operator-поезд, REGISTRY) | — (подтвердить) |
| 6 | E2 (эмиссия обоих режимов, dedup, CDP) | ✅ | B1-диспатчи в V3DataInterceptor (Operator-поезд) [verify-PC CDP] | — (подтвердить) |
| 7 | E3 (фасад + rehearsal) | ✅ | фасад + rehearsal (Operator-поезд) [verify-PC] | — (подтвердить) |
| 8 | Practice-gate (749/749) | ✅ | мок-дрифт закрыт, 749/749 (PLAN §3) [verify-PC] | — |
| 9 | Cut-list из E4-A | 🔴 открыто | — | **W3** (cut-list V2-recovery-веток поимённо) |
| 10 | M3-VERIFY: dist-grep + positive-контроли ПЕРВЫМИ | 🔴 открыто | — | **W4 gate** (Ц3 4.1b; MICRO-PACK-WAVE4 M3-VERIFY) |
| 11 | FALLBACK-VERIFY: CDP V1–V10 + уши-строки | 🔴 открыто | — | **W3 smoke V1–V5** + **PHASE 5 финальный verify** [verify-PC CDP + уши-Босс] |
| 12 | Ретир V2-recovery (поимённо, 0 wildcard) | 🟡 в работе | W3 применён Оператором в дерево (4 DELETE + 6 MOD), НЕ закоммичен (ребут) | **W3** — Вёдра доводит: 8 гейтов + scoped-коммит |
| 13 | Флип VITE_ENGINE ×3 одним коммитом | ✅ `2395c1e7` | engine-mode.ts:5 + .env.example:23 → v3 | **ДЕВИАЦИЯ:** исполнен БЕЗ App.tsx:88 (легитимный рефактор, PLAN §8) — зафиксировать |
| 14 | Dual-тег: pre-M3=П-12 / pre-M5=repo-rollback | 🟡 частично | pre-M3 поставлен на `2395c1e7` | pre-M5 → позже (repo-rollback) |
| 15 | П-8 зафиксирован | 🔴 открыто | — | **mic-уши-сессия** (LATENCY-REGISTRY §E) [уши-Босс] |
| 16 | 0 новых tsc | ✅ | tsc=306 (WAVE-PREFLIP-BASELINE; держится каждым гейтом волн) [verify-PC] | — |
| 17 | TSC-ledger запись | ✅/проверить | TSC-ledger (PLAN §2) [verify-PC] | — |
| 18 | Канон терминов: V2-recovery (умирает M3) / V3-fallback-varispeed (переживает) | 🔴 открыто | — | **W3** (терминологическая дисциплина, MICRO-PACK-WAVE3 §ДИСЦИПЛИНА) |

### + BAC-110 (вне 18, влито per SYNC-r:44)
| — | grep подписчиков `V3StatePublisher` | ✅ safe | legacy-подписчиков НЕТ, только V3-own (`useKeyboardShortcuts`/`takes.time`/`TransportV3`/`index.ts` + test) — Hub прогнал, REGISTRY:32 | — |

---

## Сводка для Hub
- **Полностью закрыто:** 1, 2, 3, 5, 6, 7, 8, 13(девиация), 16, 17 + BAC-110 = 10 из 18 (+1).
- **Частично:** 4 (mic-уши: v-Mix/№17/№18 ✅, остаток→mic-сессия), 14 (pre-M3 ✅, pre-M5 позже).
- **Открыто → волны:** 9, 12, 18 → **W3**; 10 → **W4 gate**; 11 → **W3-smoke/PHASE-5**; 4, 15 → **mic-уши-сессия (W3→W4 gap)**.
- **Ключевая девиация (строка 13):** флип `2395c1e7` исполнён БЕЗ `App.tsx:88` (engine-mode.ts:5 + .env.example:23) — легитимный рефактор per PLAN §8, фиксирую явно, чтобы не было расхождения с шаблоном §3.

## Что нужно от Hub/Босса для полного закрытия
1. [verify-PC] Вёдра подтверждает CDP/tsc/vitest-строки (1,6,7,8,16,17) после своих запускаемых гейтов W3.
2. [уши-Босс] mic-уши-сессия между W3 и W4 закрывает 4(остаток) и 15.
3. W3-коммит Вёдры закрывает 9, 12, 18.
4. W4 gate закрывает 10; PHASE-5 — 11.

— 007_Мак. DRAFT v1: собрано по документальным evidence; строки [verify-PC]/[уши-Босс] ждут подтверждения. Готов править по замечаниям Hub.
