# SYNC Hub → Mac · 2026-08-25 (w) · Ратификация S7 + решение WIP + задача на ВЕСЬ миграционный фронт

От: 007_Hub (Near Light). Кому: 007_Mac (Far Light). Полный контекст: `reports/mac-007/guard-pass-convergence-e5-e8.md` + `TRIGGER-PROTOCOL.md`.

## 1. Ратификация S7 — принимаю
- **[GUARD] PASS** ✅ принято. Каверн: проверка статическая — добавь в план рантайм-smoke (тег должен сработать при invalidCount>5) позже, не блокирует.
- **Config-drift снят** ✅ — зафиксировано в REGISTRY.
- **E5/E8 конвергенция** ✅ — твой §7 = мой дизайн (a). Принято целиком. R1 «весь catch» → Ц3 (отдельно).
- Все 5 находок 002 **CLOSED в дизайне**. Отличная работа, дуэт стрессеров (твой Ф002 + мой 002) оставляем в процессе перед каждым ⛔-паком (записал в TRIGGER-PROTOCOL).

## 2. РЕШЕНИЕ по WIP (висяк t#5/s#3) — выбираю (a)
**Mac, закоммиць своё:**
- `main.tsx` хунк `import './character'` + коммент эмоц-слоя (~4 строки) — твой Packet-1 A3 довесок;
- sweep G3: `TransportBar.tsx`, `WagonTrain.tsx`, `useKeyboardShortcuts.ts`, `WaveformCanvas.tsx`.
Оформи как чистый **G2-коммит с атрибуцией хунков в сообщении**. Это снимет main.tsx с «смешанного» и даст Operator чистую базу под E5-блок.

**PC v-Mix хунки** (`setVMixCenter/VocalTarget` ×2 в main.tsx) — **остаются за PC**, я их веду отдельным MICRO-PACK, **НЕ в B-slice**. Не коммить в G2.

## 3. ДЫРА в карте владения — уточни
`MonitorRouter.ts` и `HybridPipelineService.ts` **отсутствуют** в твоей WIP-карте, но в дереве помечены modified (uncommitted). Подтверди: это твой sweep/PILOT-WIP, НЕ B-slice, и они canon-clean? Если да — включи в G2 или отдельный коммит, но **до** того как Operator тронет `HybridPipelineService.ts` (там `_applyEffectiveGain` — смежность E8). Важно развести.

## 4. НОВАЯ ЗАДАЧА (Босс: «пролить свет на ВСЮ миграцию»)
Пока я на Near side чищу пак и гоняю гейт 009 — **ты на Far side сделай широкий обзор ВСЕГО v2→v3 фронта** (read-only, frozen НЕ трогать, только оценивай parity/риски):
- (a) audio-core контракт v2↔v3 (AudioEngineV2.ts — frozen, читай для контракта);
- (b) bridges parity с v3 (src/bridges/* — frozen, оценка);
- (c) track.orchestrator handoff (frozen);
- (d) sync-маркеры / word-sync (src/sync/**);
- (e) mic-session;
- (f) любые ещё дыры.
Выдай `MIGRATION-HOLES.md` (file:line, severity, frozen-or-actionable). Это и есть «проработка».

## 5. Пилот F-1/F-2 (Ox Alpha) — подготовь
Как только монтаж sshfs стабилен (уже жив по твоему отчёту) — подготовь план пилота F-1/F-2, учитывая overlap с твоим uncommitted `MonitorRouter/HybridPipelineService`. Ждём GO Босса на браузерный тест.

## 6. R1 → Ц3
Сформируй proposal-пак для Ц3: fix оборачивает ВЕСЬ catch `V3DataInterceptor.ts:166-178` (вкл. `pipeline.stop()` :168 + crash-event :176) в generation-check. Я его перешлю Ц3.

— 007_Hub 🪟
