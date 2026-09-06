# MICRO-PACK · В-1а: ТРАНСПОРТ-НАРРАТИВ (К2-волна V2-похорон, остаток Д-1-хвоста) · 2026-09-01

**Автор:** 003 (пара 003+003_2) · **Фураж:** досье WAVE-V1-DOCS-HARVEST (скаут-O классификация + сверка 003_2: 14 подтверждённых + 2 бордлайна = 16; 3 audio-engine строки исполнены 007 в `fbf07aa`) · **Стресс:** 002 (прогон следом) · **Верификатор:** 003_2 (подпись после применения 007)
**Версия:** v1.1 — стресс 002 «ТРЕБУЕТ ПАТЧА» (4 условия: гейты 1/3 переформулированы, якорь :66→:67 сдвиг FG-CI, хвосты → волна-B-очередь) → все внесены
**Статус:** СПЕКА v1.1 (НЕ применять до приёма 200; после Волны A — очередь 007)
**HEAD-SSOT на момент сборки:** `99f2a82` · канон: tsc=290 🔴 · vitest 808+0int+0load 🟢 (69) · PARITY PASS 🟢 · frozen 19/19 машина (FG-CI)
**Канон-шаблон правки (без «authority» — 002-условие-5 из F):** «V3 — дефолт с 28.08 (W6-финиш); transport-слой = V3 (фасад js/audio-facade-v3.js + engine-v3/); frozen V2 — до M5 (read-only, PLAN-v3.3)»

## Основной состав (14 строк)

| # | Файл:строка (контент-якорь) | Было → Стало |
|---|---|---|
| В1-1 | docs/architecture/central-bridge.md:41 | V2Adapter «Единственный мост к frozen V2» → «Живой мост V2↔V3 (delegateSync, V2Adapter.ts:51)» |
| В1-2 | docs/architecture/frozen-zones-v2.md:67 (якорь контентный «единственный bridge»; :66→:67 сдвиг FG-CI-🔒-строки) | «ЧИТАТЬ через V2Adapter (единственный bridge)» → «ЧИТАТЬ через V2Adapter (мост V2↔V3)» |
| В1-3 | docs/architecture/takes-system.md:194 | «Transport authority = AudioEngineV2» → «Transport = V3 (фасад); frozen V2 — делегируемое ядро (до M5)» |
| В1-4 | docs/architecture/takes-system.md:873 | «Full transport authority remains in AudioEngineV2» → «Transport = V3-слой (W6-финиш); frozen V2 — до M5» |
| В1-5 | docs/architecture/reactive-lyrics-foundation.md:86 | «**Owner:** AudioEngineV2» → «**Owner:** V3 transport (фасад)» |
| В1-6 | docs/architecture/reactive-lyrics-foundation.md:158 | «AudioEngineV2 currentTime» → «фасад currentTime (V3)» |
| В1-7 | docs/architecture/reactive-lyrics-foundation.md:445 | «transport authority in AudioEngineV2» → «transport in V3-слое» |
| В1-8 | docs/architecture/performance-quality-system.md:62 | «Owned by: AudioEngineV2» → «Owned by: V3 transport (фасад)» |
| В1-9 | docs/BILI-CONTEXT.md:70 | «AudioEngineV2 — единственный транспортный авторитет» → «V3 — дефолт (28.08); transport-слой V3; frozen V2 — до M5» |
| В1-10 | docs/guides/Onboarding Route 2.1.md:50 | «AudioEngineV2 transport authority» → «V3 transport (js/audio-facade-v3.js)» |
| В1-11 | docs/guides/Onboarding Route 2.1.md:123 | «AudioEngineV2 as transport authority» → «V3-фасад as transport» |
| В1-12 | docs/guides/Onboarding Route 2.1.md:567 | «AudioEngineV2 is transport authority» → «V3-фасад is transport surface» |
| В1-13 | docs/guides/Onboarding Route 2.1.md:684 | «[ ] verified AudioEngineV2 transport authority» → «[ ] verified V3 transport (фасад js/audio-facade-v3.js)» (калибровка 003_2: предмет проверки, не только имя) |
| В1-14 | docs/modernization/04-bLb-BRIEFING.md:119 | «I-2. AudioEngineV2 владеет транспортом» → «I-2. Транспорт — V3-слой (W6-финиш); frozen V2 — до M5» |

## Бордлайны (2 — вердикт 003_2 «править синхронно», судьба audio-engine.md решена F-2)

| # | Файл:строка | Было → Стало |
|---|---|---|
| В1-15 | docs/INDEX.md:12 | «audio-engine | AudioEngineV2 + transport + stem system» → «audio-engine | V2 frozen-хвост + V3 transport + stems» |
| В1-16 | docs/architecture/track-meta-pipeline.md:382 | «audio-engine.md | AudioEngineV2 транспорт» → «audio-engine.md | V2 frozen + V3 transport» |

## К3-защита (НЕ трогать — гейт-0)

- docs/modernization/09-BLB17-RETRACTED-SYNCED-CHECK.md:45 — ретракт-запись эры (цитата состояния 22.08), правка фальсифицирует историю
- Все документы archive/superseded, operations/packs, handoff, interaction-schema-2.1 — эра

## Гейты применения (007, после Волны A)

1. **Нарратив-гейт (v1.1, по 002):** в 10 файлах пака — 0: `rg -n "транспортный авторитет|transport authority" docs/architecture/central-bridge.md docs/architecture/frozen-zones-v2.md docs/architecture/takes-system.md docs/architecture/reactive-lyrics-foundation.md docs/architecture/performance-quality-system.md docs/BILI-CONTEXT.md "docs/guides/Onboarding Route 2.1.md" docs/modernization/04-bLb-BRIEFING.md docs/INDEX.md docs/architecture/track-meta-pipeline.md` → 0. **Факт-отчёт остатка (не гейт):** `rg -c ... docs/ -g '!archive' -g '!operations' -g '!modernization/handoff' -g '!09-BLB17*'` → база 30 → после пака ~22 (все остатки классифицированы: audio-engine.md ×7 — F-2-термин + :429 очередь B; interaction-schema/architecture-map SUPERSEDED ×6 — эра; Onboarding :80/:216/:228 — §-заголовки/списки, очередь B; takes :236/:534, reactive :85/:112, sync-system:256, doctrine:136 — очередь B-сверка)
2. **Ретракт-гейт-0:** `sed -n '45p' docs/modernization/09-BLB17-RETRACTED-SYNCED-CHECK.md` → без изменений
3. **Якорь-гейт (v1.1):** `rg -c "V3 transport|V3-фасад|мост V2↔V3|V3-сло|transport-слой V3" docs/architecture/ docs/guides/ docs/BILI-CONTEXT.md docs/modernization/04-bLb-BRIEFING.md` → **≥16** (паттерн синхронизирован с «Стало» по 002)
4. Канон Δ0 (только .md) · frozen-манифест не затронут (19/19 — машина)
5. Смоук: 3-4 дока глазами (central-bridge, Onboarding, BILI-инвариант)

## НЕЛЬЗЯ

- НЕ трогать PLAN-v3.3 §1/§2 (территория Ц3 — спорное-2 конвоя: приписка «см. frozen-manifest.json» на отдельное согласование)
- НЕ трогать ретракт 09-BLB17 (К3) · archive/packs/handoff
- НЕ вводить «authority»-формулировки (002-условие-5) — шаблон в шапке
- НЕ применять до Волны A (порядок: DOC-WAVE-A → В-1а — один исполнитель 007, разные коммиты)

## Очередь волны-B (зафиксировано 002, вне пака — не терять)

- **audio-engine.md:429** «Confirmed transport authority: AudioEngineV2» — приоритетный кандидат B (fbf07aa не тронул, в паке нет — не скоуп В-1а)
- Onboarding :216/:228 «actual runtime transport authority» + :218/:220 — после Волны A станут битыми путями (js/audio-engine.js + patchV1 снесены — смоук-гейт Волны A увидит)
- takes :236/:534, reactive :85/:112, sync-system:256, doctrine:136 — остатки для B-сверки
- interaction-schema-2.1/architecture-map-2.1 — SUPERSEDED (эра, не трогать; в факт-отчёте остатка числятся)

## Маршрут

003 (спека) → **002 стресс** → 003_2 сверка/подпись → приём 200 → 007 (после Волны A) → двойной DOC-CHECK пары → LOG.

— 003 · пара 003+003_2 · 2026-09-01
