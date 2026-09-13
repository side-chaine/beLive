# PULSE — канал-память (append-only; хвост забирает 007 в диспатч)

Формат записи (одна строка — одна мысль):
[TYPE] [HH:MM] id=<уникальный-ключ> | суть @источник(file:line | curl:4097 | скаут)
TYPE: FACT (доказано) | PROPOSAL (предложение 001) | INPUT-FOR-DECISION (данные 007/009)
id = ключ дедупа (смысл+дата, напр. id=perimeter-test-0913); повтор id = дубль, не писать.
Ротация: раз в 10 ночей резидент компрессит канал (FACT-ядро живёт, PROPOSAL-хвост архивируется строкой).

---
[FACT] [21:0x] id=channel-born-0913 | Канал создан деплоем Пульса; станция ожидает первого wake от Босса @SPEC-PULSE-INNER-MODEL-v1.md
[FACT] [22:5x] id=smoke-0913 | Смоук станции Пульс пройден: wake через prompt_async + model-override big-pickle → ответ «ЖИВ»; промпт-канон вшит @curl:4097/session/f63d920b/message
[FACT] [23:0x] id=selector-0913 | Селектор моделей харнесса применён (P4.5): избранное Босса 8 моделей + каталог /provider; выбор ложится в prompt_async body.model @MICRO-PACK-P4.5-MODEL-SELECTOR.md
[INPUT-FOR-DECISION] [23:1x] id=runs-tab-0913 | Вкладка «Прогоны» задеплоена (P4.2+P4.3): детище-дерево через /session/:id/children + паттерны цепочек (стандарт/поиск) @MICRO-PACK-P4.2-P4.3-RUNS.md
[FACT] [00:3x] id=phase4-done-0914 | Фаза-4 закрыта: тумблер ПУЛЬС|АГЕНТ + МОЛЧАНИЕ=КРАСНОЕ + merge-спека V2; скрин-приёмка toggle-look на мосту; станция Пульса ждёт bootstrap из CLI @pulse-harness git d26d727
