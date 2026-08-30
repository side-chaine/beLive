# 427-REPORT (C27) — SINGLE-WRITER effectiveGain: РЕТЕСТ ПРОЙДЕН, Явления A/C закрыты, mute-катч закрыт

**Коммит:** C27 = `d42cc94` — single-writer effectiveGain в V3 (parity V2._applyEffectiveGain), RouteCheck effective-aware, MX-03 рестейт, fallback-маркер
**Верификация:** tsc 314 (база), vitest 749/749 (2 legacy-суита — предсуществующие)
**Живой ретест (уши):** ✅ 24.08.2026

## 1. Решения Ц3 — исполнены
| Пункт | Решение Ц3 | Исполнение |
|---|---|---|
| Явление A (solo-пробив фейдером) | single-writer effectiveGain, (c) отклонён | ✅ C27 |
| Скрытый катч (mute-пробив) | аудит-строка, effectiveGain закрывает оба | ✅ закрыт |
| Явление C (RouteCheck) | переключить на effectiveGain | ✅ C27 |
| Эталон V2 (предусловие) | frozen-чтение: V2 НЕ пробивается | ✅ паттерн перенесён 1-в-1 |
| Fallback-строка | аудит orchestrator-пути | ✅ no-op в V3 (MP-23), маркер в sync:149, защита в pipeline |
| Doc-hygiene | MX-03 рестейт + solo-маска | ✅ AUDIO-BEHAVIOR-SPEC.md |

## 2. Эталон V2 (frozen-чтение, AudioEngineV2.ts)
`setStemVolume`:1088 / `setStemMute`:1105 / `setStemSolo`:1121 → все через `_applyEffectiveGain`:1144:
`effectiveMute = isMuted || (anySoloed && !isSoloed)` → `gain = effectiveMute ? 0 : rawVol * busVol`.
**V2 НЕ пробивается** ни solo, ни mute; raw живёт отдельно (`_stemVolumes`) → снятие solo возвращает новую громкость. Это и есть MX-03. Фикс = parity-восстановление, не нововведение.

## 3. Что в C27 (пак A)
- **HybridPipelineService:** поля `_stemRawVolumes`/`_stemMuted` (parity V2), чистая функция `_effectiveGainOf(stemId)` (mute||!audible → 0, иначе raw), единственный writer `_applyEffectiveGain(stemId)` (stretchGain ramp + stem.volume). Все три сеттера (`setStemVolume`/`muteStem`/`soloStem`) идут только через него. `soloStem` пересчитывает все стемы по маске.
- **StemChain:** аксессоры `isSoloActive()`/`isStemAudible(stemId)` (новые, не frozen; существующий код не тронут).
- **stem-engine-sync:** удалён SOLO-RESTORE re-apply C25/C26 (избыточен — raw теперь в pipeline), fallback-маркер на :149.
- **RouteCheck:** `audible = |masterGain| > EPS && effectiveGainOf(stem) > EPS`.
- **AUDIO-BEHAVIOR-SPEC.md:** MX-03 статус `—` → `✅ v3 (single-writer effectiveGain, пак A 24.08)` + примечание V3-рестейт с формулой.

## 4. Живой ретест (пользователь, v3-конфиг, сессия)
**Вердикт пользователя: «да! уже намного лучше! сбоев по звуку не заметил!»**

Шаги ретеста (по чек-листу Ц3):
1. Solo на X → остальные замолчали ✅
2. Фейдер не-соло стема при активном solo → **тишина** (раньше пробивался) ✅
3. Отжатие solo → стем звучит **сразу с новой громкостью** ✅
4. Mute → фейдер → **тишина** (катч mute закрыт) ✅

## 5. Косвенное подтверждение Явления C (из консоли сессии)
```
RouteCheck ✅ 6 routes, active=stretch   (все стемы)
RouteCheck ✅ 1 routes, active=stretch   (после solo — только соло-стем слышен)
```
**Диагностика теперь видит то, что слышат уши** — solo-маска отражается в отчёте маршрутов. Ранее было бы 6 всегда.

## 6. Консоль сессии — чисто
- Бут v3: 7/7 StretchInstance Init, Phase F ACTIVE, Cage активирован, watchdog 3 прохода ✅
- Трек 1787200209918: 6 stems загружены, RECON-1 старт ×1.000, autoplay ✅
- M2-latency: **1238ms** — внутри [1156–1476] ✅ (регрессии нет)
- `[VOC] Vocals stem not ready after 15s, skipping VOC` — штатный авто-детект VOC (у трека нет VOC-бандла), не баг
- Единственная ошибка: CORS feed-bot (известное, https://app.mybelive.com origin mismatch — фид-бот не наш)

## 7. Статус бандла (коррекция по Ц3)
| Пункт | Статус |
|---|---|
| 1/7 метры | ✅ PASS (ранее) |
| 2/7 микшер | 🟡 → **✅ АПГРЕЙД**: звук ✅ + solo-маска ✅ (ретест 24.08) |
| 3/7 SPLIT | conditional (железо) + CDP R1-proof (план — драйв без ушей) |
| 4+ | ждут: П-8, Visual, 389, loop-cleared, takes, RTL |

## 8. Следующий шаг (по порядку Ц3)
**MICRO-PACK B — мост индикации** (Явление B, решение (b) сейчас):
- readMeterV3 (патч 366) уже работает в Visual-режиме — обычному режиму тот же вызов в том же rAF-цикле
- isV3-гейт моста — pipeline-presence семантика (шаблон (iv) из E1)
- «не возвращается, пока не задеть» уйдёт автоматически — живой rAF вместо diff-цикла стора
- Малый пак, затем ретест индикации ушами → продолжение бандла 4+

## 9. M3-GO-шаблон (приращение по Ц3)
- «solo/mute-инвариант ✅ (уши)» — закрыто 24.08
- «индикация обоих режимов живая (уши)» — ждёт пак B