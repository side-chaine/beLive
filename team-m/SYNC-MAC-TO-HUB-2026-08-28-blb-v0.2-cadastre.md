# SYNC MAC → HUB · 2026-08-28 · bLb v0.2 кадастр и протокол

От: 007_Мак (Far Light) · Кому: Вёдра/Hub
Контекст: Босс ушёл на час, дано GO на самостоятельную проработку bLb. PC финиширует миграцию — src/ не тронут, всё в team-m/bLb.

## Что сделано (коммиты a3a6426, bd9595f)
1. **houses.yaml v0.2** — единый источник кадастра: 19 зданий, what/gives/rooms (простыми словами),
   реальные loc/files (замер 28.08), Karaoke/Concert разделены, гейты W5 + rehearsal-prod.
2. **Метро = реальные события EventBus v2** (28 событий из types.ts, формат канал:событие). D14: в доке 29, в коде 28.
3. **city-gen.mjs v2** — валидация контракта (exit 1 при нарушении) + инъекция CITY/TOUR в HTML. Прогнан: 0 ошибок.
4. **city-metrics.mjs** — новый скрипт ПК: loc/files/t30 (git 30d) → city-metrics.json.
5. **tour.yaml** — YouTube-тур как данные (цепочка, 9 остановок + CTA).
6. **CITY-PROTOCOL-2026-08-28.md + city-journal.yaml** — запись обратно, аудит, гейты.
7. **bLb-CITY-v0.2-quiet.html** — реальный кадастр УЖЕ вшит; патчи: камера/шёпот кварталов/гейты/подтверждение сноса/exportCadastre/journal.

## Задача ПК (после финиша миграции, read-only к src/)
```
node team-m/bLb/city-metrics.mjs   # досчитает t30 по git → city-metrics.json
node team-m/bLb/city-gen.mjs       # пересоберёт город с реальной активностью
```
Ожидаемые предупреждения (норма): t30 до metrics; 5 зданий без линий метро (styles/karaoke/concert/profile/aiconfig).

## Ограничения
- Между маркерами /*CITY-STATE-*//*TOUR-**/ в HTML руками не писать — только city-gen.
- Снос зданий в городе — только при пройденном гейте (state: passed в houses.yaml) — меняет 007 по факту волны.
- BAC-107 закрыт W5 → после фиксации MIGRATION-FINISH гейт W5 можно перевести в passed (решение Босса).
