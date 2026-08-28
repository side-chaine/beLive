---
agent: 007-vinda (Hub)
task: migration-status
status: delivered
updated: 2026-08-28
---

# 🌊 МИГРАЦИЯ V2→V3 · Статус на 2026-08-28 (после Flip + W1 + W2)

> Разведка: 007_Винда + research-скаут (read-only, все grep выполнены 28.08 в живом дереве).
> Ветка: `backup/win-V3-finish_2-2026-08-23`, HEAD `81c3e66`. Push 🔒 до GO Босса.
> Канон-снапшот (замер 28.08): **tsc=306 · vitest=767 passed + 5 intentional fail + 2 load-fail · PARITY PASS · frozen-guard 🟢 GREEN**.

---

## §1. ЧТО УЖЕ ПРИМЕНЕНО

| Шаг | Коммит | Что сделано |
|---|---|---|
| **M3-GO FLIP** | `2395c1e` | `engine-mode.ts` default `'v2'`→`'v3'` + `.env.example:23` → `VITE_ENGINE=v3`. Позитивный критерий флипа достигнут: `import.meta.env.VITE_ENGINE` в src/ ровно в 1 файле. |
| **WAVE1** | `521cb82` | Cut V2 activation: удалены `tryActivateV2`/`patchV1`-импорт (BAC-103/104, BAC-105 safe-scope). Побочный эффект: R1 снят — cage/ae-guard/ResurrectionDetector стали мёртвым кодом (снос W3 безопасен). |
| **WAVE2a** | `ba184c5` | `seekTo` delegateSync→`getTransport()` в 7 app-caller'ах. |
| **WAVE2b** | `d0e31af` | Re-point остальных app-caller'ов delegateSync → V3 transport/stores (drop V2Adapter-импорты из app-слоя). |
| BAC-108 (вне волн) | `8d7b5c9` | Gateway fail-loud decouple + `VITE_GATEWAY_URL` в прод-чеклист ДО E7. `grep localhost:8787` = 0. |

## §2. ЖИВЫЕ СЧЁТЧИКИ (замер 28.08 vs baseline 26.08)

| Маркер | Baseline (ДО) | Сейчас | Дельта / комментарий |
|---|---|---|---|
| `tryActivateV2` | 3 | **0** | ✅ W1 done |
| `patchV1` в featureFlag | 2 | **0** | ✅ W1 done; в src осталось 2 хита: frozen-деф `patchV1.ts:9` + коммент `main.tsx:269` |
| `delegateSync` файлов | 11 (non-test) | **13 raw / 11 non-test** | App-вызовы сняты W2a/b; остаток = внутрянка engine-v3 (V2Adapter-деф, IV2PublicContract, DuckGuardV3, Cage, ResurrectionDetector) + legacy-орфаны ×4 + 2 коммента (main.tsx:224, stem-engine-sync.ts:3) |
| `V2Adapter` файлов | 18 | **20 raw** (из них 3 теста) | Методика baseline иная («после def/barrel»); DEFER по W4 — жив до последнего caller'а |
| `track.orchestrator` живых импортёров | 3 | **3** (MixerPanel:180, QuickActions:214, track.actions:7) | W4 не начата; +2 коммента + self-header |
| `window.*` V2-глобалы (узкий паттерн) | 62 файла (широкий аудит) | **8 файлов** | Паттерн диспатча ýже baseline-аудита; из 5 RED-нарушений frozen-guard 26.08 ныне GREEN; в 8 входят 2 frozen (blocks.bridge.ts + mode-switch.bridge.test.ts) |
| `__restoreV2Engine`/`__switchToV3` | 2 | **6**: live = main.tsx:154 (вызов) + main.tsx:215 (def) | 4 коммента; def живёт до W3/W5; `js/audio-facade-v3.js:10` — жив def `__restoreV2Engine` |
| `V2AudioCage`/`ResurrectionDetector` | 29 | **24 хита** | W3 не начата |
| Stub-импортёры (BAC-107) | 2 | **2** (facade.ts, main.tsx) | W5 не начата |
| `src/legacy/engine-v3/` | 9 файлов | **7 .ts + __tests__** (орфан) | Цель W4 (DELETE) |
| `track.loader.ts` | — | **отсутствует** | Создаётся в W4 |

Проверка нетронутости W3-скоупа: `__guardAeMethod`×3 в main.tsx, cage-блок main.tsx:121-126, `attachCage` в V3DataInterceptor.ts:4/43/58 — всё на месте (W3 = 0%).

## §3. ОСТАТОК: W3 → W4 → W5 (каждая 0%, порядок обязательный)

### W3 · Demolition (1 коммит) — `MICRO-PACK-WAVE3.md`
- **Скоуп:** V3DataInterceptor (cage-хуки L4/43/57-61/171-173) · **DELETE** V2ResurrectionDetector + V2AudioCage + DuckGuardV3 + duck-guard.test.ts · main.tsx (import L17, cage-блок, L154 restore→crash-modal остаётся, ae-guard wrap ~L265-292) · BusFader18.test — RETAIN-аннотация (§9).
- **Гейты:** tsc==306 · vitest проекция 761 (−6) · PARITY · SHA256 frozen идентичен · grep-ноль по терминам W3.
- **Риски:** R1 снят W1 (V2 No-Birth ⇒ silence-код мёртв). DuckGuardV3 удаляется ДО W4, иначе tsc-падение.

### W4 · Orchestrator re-point + legacy delete — `MICRO-PACK-WAVE4.md`
- **Скоуп:** создать SAFE `track.loader.ts` (1:1 перенос loadTrack+loadStemsOnDemand + ре-экспорт `window.trackOrchestrator`/`queueTrackJump`) · переключить track.actions:7, MixerPanel:180, QuickActions:214 · **DELETE** `src/legacy/engine-v3/*` (9 файлов) · V2Adapter = **DEFER** (не удалять, grep≠0).
- **Гейты:** tsc==306 · vitest «0 новых ошибок» · PARITY · SHA256 · 0 SAFE-импортёров orchestrator · M3-VERIFY dist-grep (negative proof + positive-контроли).
- **Риски:** без ре-экспорта глобалов умрёт keyboard-nav (R1 пака).

### W5 · Finalization (BAC-107/109/110) — `MICRO-PACK-WAVE5.md`
- **Скоуп:** blockEditor.service (patchWaveformEditor 103-150+168) · main.tsx (stub-импорты/вызовы, L154; L155 `__setV3Active` сохранить) · facade.ts:51 FIXME · js/audio-facade-v3.js L8-10 · **DELETE** 2 stub-файла · console-гигиена (BAC-109) · V3StatePublisher:129 (BAC-110) · доки (BAC-111).
- **Гейты:** канон + boot-smoke CDP V1/V5 · SHA256 · grep-ноли.
- **Риски:** W3∩W5 по main.tsx:154 — идемпотентен (единственное пересечение волн).

**Почему порядок строгий:** DuckGuardV3 (W3) до V2Adapter-вопроса (W4); dist-grep W4 до финализации W5.

## §4. ОБЩИЙ ГЕЙТ КАЖДОЙ ВОЛНЫ (WAVE-HANDOFF-INDEX)

канон 306/767+5int+2load + PARITY PASS + boot-smoke CDP V1/V5 + SHA256-инвентарь frozen ДО/ПОСЛЕ идентичен + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых safe→frozen).

**PRE-GO CHECKLIST (Ц3 4.5/#5):** (1) closure-таблица Мака 18 строк получена; (2) frozen-guard 🟢 GREEN каждой волны; (3) BAC-108 закрыт ДО E7 ✅ (8d7b5c9); (4) G-трек реактивирован (425+G0-draft #4); (5) mic-уши-сессия между W3 и W4.

## §5. НЕЗАКОММИЧЕННОЕ В ДЕРЕВЕ (влияет на чистоту apply)

- `src/js/ai/registry.ts` (+46) · `src/js/utils/stream-openai.ts` (DELETED) · `package.json` (+1) — похоже на M4 unify (REGISTRY §2 DONE, но не закоммичен). Детали в ОТЧЁТЕ 4.
- Большой слой team-m/docs чистки (56 файлов, −1475 строк) — архивация sync-доков 25.08.
- ⚠️ База считается «грязной» до коммита этих хвостов — Operator-поезд волн требует чистого базиса (по REGISTRY 25.08: «чистый закоммиченный базис + ре-канон перед apply»).

## §6. ВЫВОД

1. **Миграция прошла 40% пути волн** (flip + W1 + W2 из 5 волн), канон GREEN, frozen нетронут (frozen-guard GREEN, SHA256-baseline в `/tmp/opencode/frozen-baseline-sha.txt`).
2. **W3/W4/W5 полностью готовы к исполнению** (паки финализированы цепью 001→002→001→009 = РЕШЕНО), каждая сейчас 0%.
3. **Блокер apply:** незакоммиченные хвосты (§5) + один GO Босса на поезд W3→W4→W5 (рекомендация Вёдры 26k §7#1 + Мака: цепь 001→002→009, авто-гейты).
4. После W5 — финальный гейт (dist-grep V2-символов = CLEAN) → **post-m3 открыт** → город beLiveBase строится (ОТЧЁТ 1).

---

*Все цифры §2 — вывод живых grep'ов 28.08. Ничего не изменено. 🌊*
