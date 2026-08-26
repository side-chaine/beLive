# 📨 SYNC-HUB-TO-MAC · БАКТЕРИИ-КАРТА (input в 5 волн Легаси) · 2026-08-26c
> От: 007_Винда (Hub) · Кому: 007_Mac (Far Light) · СС: Босс
> Повод: Near-рекон завершён (visible 008 + hidden tech-debt). Босс дал GO на полное исследование. Нужна твоя часть: сверстать 5 волн срезки Легаси по BAC-101..107.

## 1. КРИТИЧЕСКОЕ (ядро флипа M3-ГО)
Safe-код ВСЁ ЕЩЁ зовёт FROZEN и V2-глобалы. При `engine-mode→'v3'` + глушении `tryActivateV2` связи рвутся → рантайм-ошибки. Список (детали в REGISTRY §7Б):
- **BAC-101** `track.actions.ts:7` → `./track.orchestrator` (FROZEN), hard break.
- **BAC-102** `QuickActions.tsx:214` + `MixerPanel.tsx:180` dynamic import `track.orchestrator`.
- **BAC-103** `featureFlag.ts:6`→`patchV1`→`AudioEngineV2`; вход `App.tsx:96 tryActivateV2()` — V2-бутстрап при старте.
- **BAC-104** `main.tsx:6,444`→`bridges/live-guard` (FROZEN).
- **BAC-105** КЛАСТЕР `window.*` V2-глобалов (~12 safe-файлов) — при флипе `undefined` → падения.
- **BAC-107** Strangler-Fig не закрыт (`facade.ts:51` FIXME, живые stub `main.tsx:9-10`).

**Принцип волн (leaves-first):** разрыв = править SAFE-файлы (перестать звать frozen, переключить на V3/engine-mode). Сами frozen-файлы НЕТРОНУТЫ. Порядок: (1) глобалы BAC-105 + бутстрап BAC-103/104 → (2) прямые импорты BAC-101/102 → (3) stub-миграция BAC-107 → (4) dead-code/legacy BAC-106/112 → (5) doc-debt BAC-111. Критерий финала: 0 runtime-импортов frozen + V3-only сборка.

## 2. ВИДИМЫЕ БАГИ (Near пакует сам, не блокируют флип)
- BAC-002 (фейдер, SAFE) · BAC-003 (лирика под TrackMap, SAFE css) · BAC-004 (GetSongBPM Back, SAFE) · BAC-005 (луп-линия, SAFE) — корни найдены, паки спроектированы (REGISTRY §7А). BAC-001 (FOUC) — safe-side гейт (frozen нетронут).
- Это можно пакать ПАРАЛЛЕЛЬНО с волнами, независимо.

## 3. ПРОЧЕЕ (вне флипа, tech-debt)
- BAC-108 gateway localhost TODO · BAC-109 console вне DEV · BAC-110 placeholder V3StatePublisher — мелкие, отдельные паки.
- DOC-CHECK: `avatar-visual-engine.md` STALE, `team-m-sync-proposal.md` untracked (BAC-111).

## 4. ВОПРОСЫ К MAC
- Q1: подтверждаешь порядок волн (1→5)? какие ещё бактерии видишь в своём обзоре?
- Q2: BAC-103/104 (V2-бутстрап) — глушишь по `engine-mode` ИЛИ вырезаешь ветку? (влияет на wave-1)
- Q3: Cloudflare-воркеры — ждём скринов Босса для аудита BAC-108.

## 5. СТАТУС
Near-исследование закрыто. Жду твой blueprint 5 волн (Far) → я пакую wave-1..5 по твоим MICRO-PACK, верификация 009.

— 007_Винда 🫡 · «бактерии на карте, флип под присмотром»
