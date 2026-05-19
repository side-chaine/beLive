# SHIP-READINESS
> Главный рабочий документ Билли
> Отвечает на один вопрос: **Готовы ли мы к релизу 2.0 прямо сейчас?**
> Обновляется после каждого закрытого P0/P1

---

## 🔴 P0 — SHIP BLOCKERS (закрыть ДО релиза)

| ID | Проблема | Ответственный | Статус |
|----|---------|---------------|--------|
| [[P0-RECORDING-CAPTURE]] | Preview audio не попадает в Program Capture Bus | Центр№ | 🔴 OPEN |
| [[P0-TEMPO-RATE]] | tempoRate не применяется в listen steps | Центр№ | 🔴 OPEN |

---

## ✅ READY — Ship as-is

- Audio Engine / Transport — ❄️ заморожен, стабилен
- **Track Load Pipeline — 7x faster (TC-DEC-01/02): 3.5-4.6s → 0.5-0.7s** ✅
- Sync System — Line + Word, reload-durable
- Reactive Lyrics / Triggers — CSS vars, WordHighlightLine
- Performance Domain — lite/balanced/max/ultra
- N-Stem Architecture — W0-W10 все волны закрыты
- Takes / Practice Surface — canvas-first, EXLOCK, stable-2
- Exercises (stable-2) — Echo Drill, 3-Take Challenge
- Dock / Controls — restructured, Sync/Monitor/Pitch toggles
- M2 Closing Markers — verified 2026-04-13

---

## ⚠️ NEEDS POLISH

- **Monitor / Split** — Voc source connection, BV engine (Stage 2/3 pending)
- **Cover Art / Theming (W12)** — в работе
- **Auto-Lyrics (W11)** — ✅ LRC auto-sync + VOC complete (80% accuracy)
- **Vocal Onset Correction (VOC)** — ✅ L2 complete, ⚠️ L3 (multi-anchor) needs tuning, ✅ Group Drag for manual fix
- **Documentation** — ~8% gap (код опережает доки)
- **Tempo Scenario** — experimental, runtime tempoRate gap

---

## ❌ BLOCKED

- **Recording / Capture** — preview/compare не захватывается → [[P0-RECORDING-CAPTURE]]
- **Tempo Scenario listen steps** — темп не применяется → [[P0-TEMPO-RATE]]

---

## 📋 RELEASE CRITERIA 2.0

- [ ] Все ❌ → ⚠️ или ✅
- [ ] Все P0 закрыты
- [ ] Smoke test на MacBook Pro 2013
- [ ] Нет console errors в production flow
- [x] W11 Auto-Lyrics завершён (L1+L2 = 80% sync accuracy)
- [ ] Documentation gap < 5%

---

## 📊 ИСТОРИЯ ИЗМЕНЕНИЙ

| Дата | Изменение | Кто |
|------|-----------|-----|
| 2026-04-24 | TC-DEC-01/02 complete — Track load 7x faster (3.5-4.6s → 0.5-0.7s). skipDecode instrumental, accurate instrumentation. ArrayBuffer direct path cancelled (Blob URL = 1ms). | Билли + 007 + Operator |
| 2026-04-20 | W11 Auto-Lyrics complete — LRC auto-sync + VOC (TC-AL-01..04, TC-VOC-01..04). 80% sync accuracy from box. | Билли + Никита |
| 2026-04-19 | Документ создан, базовый статус зафиксирован | Билли + Никита |

---

*Обновляется Никитой по команде Билли после каждого закрытого P0/P1*
