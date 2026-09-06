# 002 · СТРЕСС-ТЕСТ направления StudioSurface · этап-3 прогона Studio

**Дата:** 2026-09-06 · **Автор:** 002 · **Вердикт: ДЕРЖИТ С УСЛОВИЯМИ** — 13 ударов, 14 условий, 3 блокирующих.
**Верификация кодом до ударов:** MonitorRouter (граф :140-156, конституция :5-6, тап vmixMicIn ДО delay), MicSourceV3 (release→stop tracks, refcount), modules.ts:74 (вкладка уже label 'Studio'), featureRegistry.ts:65-70 (третий вход: Show-сценарии дёргают setTab('mixer')), practice-session.store:367 (bpm-ramp меняет rate на лету), track-meta.service:196 (bpm может быть null/'none'), App.tsx:237-249 (гейты оверлеев только на showActive/featureActive), z-реестр 999995-999999.

## Удары (таблица — краткая выжимка)
| № | Фронт | Вердикт | Условие |
|---|---|---|---|
| 1 | INSERT невозможен без правки constructor MonitorRouter (B04-зона, TC-2C «0 disconnect») | ТРЕБУЕТ ПАТЧА | Усл.1: стык-контракт — B04 добавляет fxIn/fxOut passthrough-гейны (gain=1.0), DSP — в файлах зоны Studio; тайминг до заморозки B04 |
| 2 | V-Mix R слышит СУХОЙ мик (тап до FX) — певец настраивает эффект вслепую | ПАТЧ | Усл.2: решение Никиты «красить V-Mix» до стык-контракта (меняет ГРАФ, не параметр) |
| 3 | Ghost-echo: micSource.release() не трогает _monitorGain → эхо-петля звенит ~1.5с при мёртвом мик-е | ПАТЧ | Усл.4: mic-off ⇒ wetGain→0 рампом 20ms + тест «ghost echo после release» |
| 4 | sync-to-BPM игнорирует playbackRate; bpm-ramp-сценарий меняет rate непрерывно | ПАТЧ | Усл.5: delayTime=60/(bpm×playbackRate)×coeff, селектор из двух сторов, рамп τ=30ms |
| 5 | bpm=null → 60/0=Infinity → TypeError на AudioParam = краш включения Echo | ПАТЧ | Усл.5b: гард bpm null/0/NaN → fallback 120 (прецедент useBillyLocomotion:101) |
| 6 | @base-ui/react — первая UI-либа в истории; размер 15-30KB gz — числа НЕТ; probe:bundle заявлен «после POC» = гейт наизнанку | ПАТЧ | Усл.8: POC-гейт ДО спеки, A/B нативный-range+CSS vs Base UI, probe:bundle с бюджетом-числом; React.lazy → main Δ0 |
| 7 | Нативный vertical range УЖЕ работает (writing-mode, тач-ок по PHONE) — 30KB за --start-position? | ПАТЧ | Усл.8: решение числами A/B-прогоном, не вкусом |
| 8 | 4 паттерна фейдера в приложении (ControlDeck mouse-only / MixerPanel range / StudioSurface Base UI / InstrumentCard pointer) | ПАТЧ | Усл.14: roadmap-пункт миграции ИЛИ письменный отказ |
| 9 | 4-я ветка App.tsx: приоритет веток, z-слот (реестр занят), Escape-владелец, studioActive в гейтах оверлеев (сейчас только showActive/featureActive) | ПАТЧ | Усл.9: матрица состояний поверхностей до спеки |
| 10 | Три входа в Studio (кнопка + вкладка 'mixer' + featureRegistry setTab) + нейминг-коллизия «Studio vs Studio» (вкладка уже так называется) | ПАТBW | Усл.10: studio.store = истина, вкладка = алиас; реестр потребителей таба; нейминг-решение |
| 11 | A/B-шейперы в переходе ОБА активны → клиппинг; makeup+monitor=1 → red zone; oversample 4x на lite-тире | ПАТЧ | Усл.6: CPU-бюджет по тирам (lite=без oversampling/Character) · Усл.7: trim −3dB headroom + equal-power crossfade |
| 12 | 390px: вертикальный drag vs page-scroll, панель 240px красная по PHONE | ПАТЧ | Усл.11: mobile-спека: touch-action:none, полноэкранный режим на телефоне, min-высота |
| 13 | Канон-гейты (tsc/vitest/probe/CI Δ0) | ДЕРЖИТ | Усл.13: записать как acceptance-критерии |

## Финал 002
Направление 001 + стек 005-A + DSP 005-B **держат при 14 условиях**, из них **3 блокирующих до спеки**: ① стык-контракт B04 (fxIn/fxOut) ② решение Никиты по V-Mix-окрасу ③ POC-гейт стека с probe:bundle до спеки. Без усл.1 — UI над несуществующим DSP-путём; без усл.8 — зависимость «на глазах, а не на числах».

## Недоучтено 001/005 (улов 002)
1. **Третий вход** featureRegistry.ts:70 setTab('mixer') из Show-сценариев.
2. **Нейминг-коллизия** «Studio vs Studio» (вкладка дока уже 'Studio' — modules.ts:74).
3. **bpm-ramp** (practice-session.store:367) — rate меняется непрерывно.
4. **bpm=null → Infinity → TypeError** — NaN-гарды 005-B не накрывали bpm.
5. **REC-takes** как потребитель мика — матрица wet/dry не построена.
6. **Гейты оверлеев App.tsx** — studioActive обязан войти в каждый.
7. **V-Mix-окрас меняет ГРАФ** (переподключение vmixMicIn), а не параметр — потому блокер стык-контракта.

— 002 · этап-3 сдан · полный отчёт в цепи прогона (task ses_f878e89a8ffeIxil3oZrnr3ch4)
