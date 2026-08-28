# 🧾 CLOSURE-ТАБЛИЦА M3-GO · 18 строк (PLAN §3) · Ц3 4.2.2 · **v2 RATIFIED**
> От: 007_Мак · DRAFT v1 2026-08-28 → **v2 ратифицирован Hub-цепью (009, 28.08)**
> HEAD-якорь v2: `3623882` (ветка backup/win-V3-finish_2-2026-08-23). Пост-драфт коммиты: `02e3ac9` (W3), `7de7bd9` (W3 record), `a7aab6a`/`69970dc` (docs Mac), `3623882` (v3active-restore).
> Формат per SYNC-HUB-TO-MAC-2026-08-26r.md:44: `строка M3 | что закрыто (где/коммит) | что открыто → какая волна закрывает`.
> Источники: docs/PLAN-v3.3-CANONICAL.md §3(:53-69)/§5/§8; REGISTRY.md:32-34; WAVE-PREFLIP-BASELINE; MICRO-PACK-WAVE3/4/5; PARITY-LEDGER; MICRO-PACK-V3ACTIVE-RESTORE.
> ⚠️ Ограничения Мака: нет node → tsc/vitest/CDP не гоняю; «уши» = сессии Босса. Такие строки помечены [verify-PC]/[уши-Босс].

| № | Строка M3-GO (PLAN §3) | Статус | Что закрыто · evidence | Что открыто → кто закрывает |
|---|---|---|---|---|
| 1 | Бандл-сессия | 🟡 частично | repo-часть: теги `pre-m3go` + `pre-M3` существуют (.git/refs/tags) [verify-PC ✅] | сам бандл-файл (OneDrive/Desktop) вне репо → подтверждение Босса |
| 2 | solo/mute-инвариант, уши (C27) | ✅ уши | C27 ears: SYNC-HUB-TO-MAC-2026-08-26k.md:18; запись в PARITY-LEDGER создана 28.08 (норма Ц3-385) [уши-Босс] | — |
| 3 | Индикация обоих режимов, уши (C28) | ✅ уши | C28 ears: SYNC-HUB-TO-MAC-2026-08-26k.md:19 + console `[AETHER] ✅`; запись в PARITY-LEDGER создана 28.08 [уши-Босс] | — |
| 4 | Mic-уши (§5) | 🟡 частично | ушами: v-Mix, №17, №18 (PLAN §5) + **W3-SMOKE 28.08: фейдеры/music-bus/other ✅ (PARITY-LEDGER)** [уши-Босс] | остаток (solo-превью/vocal-fade/автопауза/RTL/П-8№2/TRIM-BASIS/B-slice×3/F-2-дубль) → mic-уши-сессия перед W4 (на усмотрение Босса) |
| 5 | E1-канонизация | ✅ | single-writer подтверждён grep 28.08: writer = `main.tsx:92-93` (bootstrap false + сеттер `active === true`, коммит `3623882`); call-sites: V3DataInterceptor:60/164/187 + main.tsx:148; читателей 29 в 16 файлах | — |
| 6 | E2 (эмиссия обоих режимов, dedup, CDP) | 🟡 статика | B1-эмиттеры живы: V3DataInterceptor.ts:240/244, MonitorRouter.ts:204; V2-режим эмитит то же в frozen AudioEngineV2 (:175/204/953/994/1017/1554) [verify-PC CDP] | dedup не разрешим статически → CDP-подтверждение |
| 7 | E3 (фасад + rehearsal) | 🟡 статика | `js/audio-facade-v3.js` существует; RehearsalLyrics.tsx:495 V3-aware [verify-PC] | volume-члены фасада = пустые стабы (:37) — B-slice не начат (PLAN §4:80), отдельный трек mic-сессии |
| 8 | Practice-gate | ✅ | мок-дрифт закрыт `1236851`; канон 28.08: **vitest 761 passed + 5 intentional + 2 load-fail** (не 749/749 — устарело) [verify-PC] | — |
| 9 | Cut-list из E4-A | ✅ **закрыто W3** | cut-list поимённо = MICRO-PACK-WAVE3.md:67 (0 wildcard); применено `02e3ac9`; gate-6 `\b(...)\b`=0, gate-5=0, негатив-контроль DuckGuardV3Native=5 (grep 009, 28.08) | — |
| 10 | M3-VERIFY: dist-grep + positive-контроли ПЕРВЫМИ | 🔴 открыто | — | **W4 gate** (Ц3 4.1b; MICRO-PACK-WAVE4 M3-VERIFY) |
| 11 | FALLBACK-VERIFY: CDP V1–V10 + уши-строки | 🟡 частично | **W3-SMOKE 28.08 = частичное покрытие V1–V5** (загрузка/плей/фейдеры/other — уши Босса) | CDP V1–V10 + PHASE-5 финальный verify [verify-PC CDP + уши-Босс] |
| 12 | Ретир V2-recovery (поимённо, 0 wildcard) | ✅ **закрыто W3** | коммит `02e3ac9` (10 файлов, −557/+5, 8 гейтов GREEN, REGISTRY:33); 4 файла удалены, frozen не тронут | — |
| 13 | Флип VITE_ENGINE ×3 одним коммитом | ✅ `2395c1e7` | engine-mode.ts:5 + .env.example:23 → v3; grep VITE_ENGINE в src = только engine-mode.ts:5 (009, 28.08) | **ДЕВИАЦИЯ:** исполнен БЕЗ App.tsx:88 — легитимный рефактор, зафиксирован в PLAN §8 (запись 26.08) |
| 14 | Dual-тег: pre-M3=П-12 / pre-M5=repo-rollback | 🟡 частично | `pre-M3` = `2395c1e7` (.git/refs/tags подтверждён 009) | pre-M5 → позже (repo-rollback) |
| 15 | П-8 зафиксирован | 🔴 открыто | — | mic-уши-сессия (LATENCY-REGISTRY §E) [уши-Босс] |
| 16 | 0 новых tsc | ✅ | канон 28.08: **tsc=302** (не 306 — сдвиг после W3; 0 NEW доказано worktree-диффом, REGISTRY:33) [verify-PC] | — |
| 17 | TSC-ledger запись | ✅ | TSC-ledger = REGISTRY (SSOT per PLAN §2:31-36); запись REGISTRY:33 «Канон обновлён: tsc=302 / vitest=761+5int+2load / PARITY PASS / frozen-guard GREEN» [verify-PC] | — |
| 18 | Канон терминов: V2-recovery (умирает M3) / V3-fallback-varispeed (переживает) | ✅ **закрыто W3** | grep `V2-recovery` в src = 0; gate-6 = 0; дисциплина задокументирована MICRO-PACK-WAVE3.md:8/32/66-67 | — |

### + BAC-110 (вне 18, влито per SYNC-r:44)
| — | grep подписчиков `V3StatePublisher` | ✅ safe (уточнено 009) | legacy-подписчиков НЕТ: инстанс только main.tsx:98 (bootAether) + ре-экспорт engine-v3/index.ts + тест. **Важно:** у события `playback-state-changed` ЕСТЬ 7 живых window-слушателей (trigger-visual.service.ts:208, PitchTab.tsx:277, stem-reactive.ts:167 + 4 frozen-моста: lyrics.bridge:171, audio.bridge:149, audio-reactive.bridge:132, stem-reactive.bridge:251) → плейсхолдер V3StatePublisher.ts:128-131 («nothing is actually listening») ЛОЖЕН — контракт живой, эмиссию сохранять. Гигиена плейсхолдера = очередь (V3-own файл, не frozen). | — |

---

## Сводка v2 (ратифицировано 009, 28.08)
- **Полностью закрыто:** 2, 3, 5, 8, 9, 12, 13(девиация), 16, 17, 18 + BAC-110 = **11 из 18 (+1)**.
- **Частично:** 1 (repo ✅ / бандл ждёт Босса), 4 (W3-SMOKE ✅, остаток → mic-сессия), 6/7 (статика ✅, CDP/verify-PC ждут), 11 (smoke V1–V5 ✅, CDP V1–V10 ждут), 14 (pre-M3 ✅, pre-M5 позже).
- **Открыто:** 10 → **W4 gate**; 15 → mic-уши-сессия.
- **Исправлено в v2 vs v1:** строки 9/12/18 закрыты W3-коммитом (драфт не знал); якорь строки 5 = main.tsx:92-93 (не :148); канон строки 16 = 302 (не 306); строка 8 = 761+5int+2load (не 749/749); цитаты строк 2/3 = SYNC-26k + PARITY-LEDGER (записи созданы 28.08); строка 17 = REGISTRY SSOT; BAC-110 = 7 живых слушателей.

## Что осталось от Hub/Босса
1. [уши-Босс] остаток mic-уши-сессии (строки 4/15) — на усмотрение Босса перед W4.
2. [verify-PC CDP] строки 6/7/11 — CDP-прогон в PHASE-5.
3. [Босс] строка 1 — подтверждение бандл-файла.
4. W4 gate закрывает 10; PHASE-5 — 11; pre-M5 тег — позже (14).

— 007_Мак (DRAFT v1) + 007_Винда/009 (ратификация v2, 28.08).
