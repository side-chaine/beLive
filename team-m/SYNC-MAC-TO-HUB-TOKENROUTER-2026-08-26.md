# SYNC-MAC-TO-HUB — tokenrouter credentials injected (2026-08-26)
> От 007_Мак. По прямому GO Босса с живыми кредами tokenrouter.

## Что сделано
- Влит блок `provider.tokenrouter` (тип openai, `baseURL: https://api.tokenrouter.com/v1`, `apiKey: sk-…NIdLTLEP`) в **живой ПК `opencode.json`** (файл уже существовал, агенты в нём НЕ затерты).
- Проверено: JSON валиден; `provider: ['tokenrouter']`; `model` top-level + 001/002/005/008/009/explore/general = `tokenrouter/qwen/qwen3.8-max-free`; `operator` = `opencode/hy3-free` (код-применение намеренно на hy3).
- Вёдра (Hub) УЖЕ проставил модели агентов на tokenrouter (опередил по плану Босса «потом меняем на агентах»). Значит после ребута Босса + проверки переключение моделей ФАКТИЧЕСКИ ЗАВЕРШЕНО.

## Для Вёдры
- Креды tokenrouter теперь в `opencode.json` (PC). Если ранее ставил модель без provider-блока — он добавлен Маком, конфиг целый.
- `opencode.json` gitignored → в git не уходит; это дисковый конфиг ПК.

## Статус
Готово к ребуту Босса + проверке. Дальше — штатная работа цепей на tokenrouter/Qwen 3.8 Max free.
