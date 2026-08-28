# BASELINE-RECOVERY · 2026-08-25 · Точка останова (обе команды штурмуют отсюда)

> Восстановленная общая точка после кучи настроек с Маком. Единая страница для PC (Вёдра) + Mac (Задроты) + Center_3.
> Источник: `REGISTRY.md`, `SYNC-HUB-TO-CENTER3-2026-08-25.md`, `CENTERS-SONNET-FULL.md`.

## 1. Закоммиченный базис (HEAD)
| Коммит | Содержит |
|---|---|
| `daffeb0` (Mac) | вердикты Соннета в репо |
| `c0084c2` (Hub) | A3 notify-bridge + D4 CoachPanel + character/sound проводка |
| `54e2847` (Hub) | N3-β #4 (пины) + §13.4 SoundCue union + pin-тест ×6 |

## 2. Канон верификации
- `tsc --noEmit` = **313** · `vitest run` = **769 passed** (2 legacy missing-import — не в счёт).

## 3. Frozen Zone (железно, обе стороны)
`AudioEngineV2.ts` · `patchV1.ts` · `bridges/*` · `track.orchestrator.ts` · `_`-поля. Миграция = обернуть v2 через `V2Adapter`, не касаясь ядра.

## 4. Согласованные дизайн-решения (канон)
- **SoundCue union** `{synth}&CueSpec | {kind:'asset',url,gain}` — внедрено в `CharacterSoundManager.ts`; Билли пока synth, тип готов под asset.
- **mood**: `listening > happy(celebrateUntil) > sing > idle`.
- **Mute ≠ reduced-motion** (раздельно); cooldown 400мс — тех-guard.
- **Два слушателя** `assistant.response.completed` (звук/аватар) — OK.
- **Billy** = первая запись реестра; панель Мака читает ТОЛЬКО реестр (ноль хардкода); `getProfileSound` = локальная ф-я в `CoachPanel.tsx` (registry.ts не трогать).

## 5. IN-FLIGHT (незакоммичено)
| Что | Владелец | Состояние |
|---|---|---|
| 72-файловый src/-sweep (миграция дерева) | Mac | IN-FLIGHT, не прогнан каноном целиком |
| P1#6 (TS2531 null-guard, tsc 314→313) | Hub | переплетён в sweep Мака, поедет с ним |
| CoachPanel body (Волна-1) | Mac | ратифицирован, ждёт носитель Мака |
| avatar UI (FallbackAvatar pop) | Mac | Волна 3, ждёт пропозал |
| Smoke «INBOX→звук» | Mac+Hub | ждёт «ГОТОВ» от Босса (dev+браузер) |

## 6. Открытые фронты (штурм)
| Фронт | Владелец | Блок |
|---|---|---|
| 425 + G4 + M3-GO | Center_3 | архитектурная спека |
| MIC-УШИ-СЕССИЯ (solo/vocal-fade/auto-pause/RTL) | Hub+Mac | бриф 006, диагноз Босса |
| YouTube-слой (§13.7) | Center_3 | research-пас |
| character-AI asset-стратегия (auto-norm gain) | Center_3 | при >2–3 персонажах |
| N3-β #6 (handleStop guard + pending-rate) | Hub | готов к MICRO-PACK |

## 7. Каналы / здоровье
- Operator `big-pickle` — стабилен.
- Named-spawn мёртв; scout/console-go блипают. Деградация: named→general+Функция→инлайн.

## 8. Следующий диагноз (Босс) и применение (Hub/Mac)
См. сообщение Hub в чате — приоритеты диагностики и кто что сажает.
