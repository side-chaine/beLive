# ROADMAP — FINAL STRETCH MIGRATION + bLb (2026-08-26)
> Босс + Вёдра → Operator + браузер-тесты; Мак параллельно гонит следующие задачи через прогоны. Директива: **закончить миграцию, ноль JS / ноль Легасив, только React + современная архитектура**.

## Фаза A — Финальная ленточка миграции (Boss + Вёдра → Operator + браузер)
Цель: завершить W1–W5 + M3-GO flip → **ноль Legacy, ноль JS-классики, только React**.
1. **Внедрить исправленные гейты** (`REPORT-MIGRATION-AUDIT-2026-08-26.md`) как ЕДИНСТВЕННЫЙ критерий done-волн (снять риск False-Green).
2. **W2 (Вёдра в процессе, WAVE2b done):** delegateSync→V3-surface (счётчик 23→11, цель 0 non-test); V2Adapter re-point 26→0 importers (исключая def/barrel); hub-and-spoke соблюдён.
3. **W3 stub-migration:** `facade.ts:51` FIXME STUB-MIGRATION; живые `live-mode.stub`/`waveformEditor.stub` (`main.tsx:9-10`).
4. **W4 orchestrator re-point** (3 importers: MixerPanel:180, QuickActions:214, track.actions:7) + **DELETE `src/legacy/engine-v3/*` (9)** + V2Adapter **DEFER** (grep≠0) + M3-VERIFY gate (dist-grep + positive-controls).
5. **W5 finalize:** BAC-107 (live-mode/waveformEditor stub + facade.ts:51) + `__restoreV2Engine` delete + hygiene BAC-109/110 + **doc-debt reconcile** (убрать преждевременные «009 РЕШЕНО» в wave-паках).
6. **W6 (НОВАЯ, из директивы «никакого JS»): JS-classic-layer PURGE** — `src/js/*` (`audio-facade-v3.js`, `monitor-mix.js`, `marker-manager.js` и др., читают V2-глобалы через `window.X`) → переписать/удалить, оставив чистый React. Это и есть «только React, никакого Легасив». (design Мака — Инициатива 1.)
7. **Pre-M3-GO checklist (Ц3 4.5):** closure-таблица 18 строк; frozen-guard GREEN; BAC-108 closed ДО E7; mic-уши-сессия; G-трек реактивирован.
- **Критерий готовности:** исправленные гейты ВСЕ GREEN + Frozen SHA256 идентичен + canon 306/767+5+2 + Босс подтверждает в браузере (VITE_ENGINE=v3 boot, нет runtime-падений от undefined globals).

## Фаза B — Мак параллельно гонит задачи (runs, пока Босс тестирует)
- **Инициатива 1 — W6 JS→React purge design:** read-only проработка переписи `src/js/*` на React-хуки/модули → `MICRO-PACK-W6-JS-PURGE-draft.md`. Не применять до завершения W1–W5.
- **Инициатива 2 — bLb (beLiveBase) город будущего:** GO_005 РЕШЕНО post-m3 read-only. Детализация кварталов/houses: `houses.yaml` — DRAFT v0.1 (`team-m/bLb/houses.yaml`, 2026-08-28, Мак); `city-gen.mjs` — НЕ существует, план MVP-1 post-M3 (`team-m/REPO-TO-CITY-MIGRATION-PLAN-2026-08-28.md`). Starbase-подобная архитектура, свой дизайн-язык beLive. `BELIVEBASE-VISION-2026-08-26.md` базис.
- **Инициатива 3 — Agent-system оптимизация:** §10 закреплён; предложить §11 (auto-post найденных инициатив в REGISTRY §7) для непрерывной синхронизации Мак↔Вёдра без ручного копипаста.
- **Инициатива 4 — DOC-CHECK apply (sync-точки 1–4 выше):** подготовить патч поправок REGISTRY/WAVE-PREFLIP-BASELINE (globals 9→62/~250, V2Adapter, model hy3-free) — ждёт коммита Вёдры его рабочего дерева, затем применяю (коорд-доки = зона Hub, не трогаю без санкции).

## Фаза C — После миграции (post-m3, отдельный GO Босса)
S3 Student-Педагог видео (patch готов), pitch-connect quality, bLb строй, CoachPanel body, M2/M3/D3/D4 фронтенд-стримы, Center/AI-assistant POST-M3 пункты (celebrateUntil, activeAssistantId, reducedMotion, FallbackAvatar pop, Billy-as-asset).

## Вердикт
Миграция в финальной стретч-фазе: W1 done, W2 в процессе, W3/W4/W5 + новая W6 (JS-purge) pending. Риск False-Green DONE снимается внедрением исправленных гейтов. Босс + Вёдра ведут Operator/браузер-тесты; Мак гонит W6-design + bLb + agent-system §11 пока идут тесты. Синхронизация: 4 точки сверки выше — ждут правки Вёдры в REGISTRY.

— 007_Мак.
