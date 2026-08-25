# MIGRATION-HOLES · полный свет на фронт v2→v3 · 2026-08-25 · 007_Мак (Far Light)

> Метод: 3 параллельных прогона [Ф001] (audio+bridges / orchestrator+sync / mic+misc) → мой стресс-свод.
> Полные таблицы: `reports/mac-007/holes-draft-{audio,sync,mic}.md`. Канон проверки: tsc 313/vitest 769. Frozen не тронут.

## 🔴 P1 — молча деградируют звук/поведение (7)
| file:line | frozen-or-actionable | суть |
|---|---|---|
| V2Adapter.ts:57 | actionable | optional-call `(v2)[method]?.()` + фантомные имена в whitelist (`setStemPan`/`setStemsMode` отсутствуют в frozen V2) → pan/mode умирают молча В ОБОИХ режимах (stem-engine-sync:195,259). Класс «solo не solo», масштабируемый |
| useTakesPlayback.ts:51-64 | actionable (E5/E3-семейство) | take-preview solo-mute зовёт raw `ae.set*Volume` → H4.1 глотает при v3 → превью поверх бэкинга; restore льёт stale store |
| V3DataInterceptor.ts:104-179 | actionable | generation-check только после decode; reset+loadStem×N без re-check → протухший лад активирует клетку и запускает СТАРЫЙ трек |
| V3DataInterceptor.ts:166-178 | actionable (**R1→Ц3**, см. R1-C3-proposal) | rollback play-timeout без generation-check гасит флаг уже играющего нового трека; `cage.deactivate()` не зовёт НИКТО — клетка односторонняя |
| main.tsx:154-193,364-366 | actionable | мёртвая зона fallback: fail init → track-loaded публикуется, `__v3Active` не ставится, «V2»=no-op фасад → app немое до reload |
| TransportV3.seek:204 (+useTakesPlayback:108) | actionable | seekTo-preview из idle тихо теряется; natural-end не паузит транспорт (у фасада нет isPlaying) — тейк стартует с 0 мимо блока |
| markers-events.ts:39 | actionable | active-line/word-sync ≥500ms живут на маркерах ПРЕДЫДУЩЕГО трека (setTimeout против авто-старта V3); VOC L2/L3 под v3 отключена (фасад без awaitStemReady/getStemAudioBuffer) → dataVersion<4 едут со сдвигом |

## 🟡 P2 — рассинхроны и мёртвые поверхности (8)
| file:line | frozen-or-actionable | суть |
|---|---|---|
| MicrophoneManager:144 / AudioEngineV2:1554 | actionable | `microphone-state-changed`/`vocalmix-state-changed` эмиттит ТОЛЬКО V2 → 🎤/VMix-тумблеры в v3 рассинхронизированы; playback-rate-changed в v3 не идёт в document; track-stem-ready/track-fully-loaded не существуют |
| MonitorRouter.ts:281 | actionable (мой WIP G5) | program-capture без хозяина: router.captureStream никто не потребляет, attachProgramSource ведёт preview только в capture-ветку → риск «пустой файл записи» в v3 |
| stem-engine-sync.ts:154 | actionable | whitelist дрейфует в обе стороны: `setBusVolume` есть в V2(:1059), нет в PUBLIC_METHODS → bus-фейдеры кидают и глотают warn |
| TakesControlStrip.tsx:254-268 | actionable | vocal-fade мёртв в v3 end-to-end (читает v2-only `stems.get('vocals').gainNode`; restore через setVocalsVolume под H4.1); в v2 — E8-class писатель gainNode без ramp |
| MicSourceV3.ts:32-42 | actionable | гонка acquire(): параллельные вызовы без in-flight мемоизации → два getUserMedia + утечка stream |
| takes.recorder.ts:70-98 | actionable | гейт движка по build-time VITE_ENGINE, не runtime __v3Active; разъехавшийся контракт ошибок (v3 silent return vs v2 throw); ctx-фолбэк может прибить analyser чужим AudioContext |
| MonitorRouter.ts:254-262 (WIP) | actionable (мой G5, фиксить ДО коммита) | setCompensateTarget зануляет _mainDelay в ОБЕИХ ветках → 'main' теряет калибровку R8; плюс дебаг-хвосты :158/:191/:209, ControlDeck:413 читает приватный _monitorGain |
| DuckGuardV3 / RehearsalTriggerWriter | actionable | контракт-ловушки мёртвого кода: getSync вне whitelist throw'ит / читает несуществующее → всегда 0 |

## ✅ Проверено — НЕ дыры
CharacterSoundManager (ASSISTANT_RESPONSE_COMPLETED) — движко-независим, оба режима ✅ (нюанс: silent-drop при suspended ctx без жеста) · notify-bridge — от движка не зависит ✅ · TODO/FIXME с v3 — 0.

## Статистика
Найдено: **7×P1 + 8×P2**. Frozen-нарушений: 0. Actionable: 15/15.
Приоритет Near Light: R1-пак (Ц3) → E5/E3-семейство (уже в пака) → event-surface v3 → fallback dead-zone.
