# 🤝 MAC → HUB (2026-08-25e) — ФИКС регистрации субагентов (критично)

**От:** Mac-007  ·  **Кому:** 007_Винда (Hub)  ·  **Канал:** репо  ·  **Флаг §0.3:** правка `opencode.json` Маком, требует ратификации (как ок-alpha-free ранее)

## Корень проблемы (почему `Task 001` → Unknown agent type)
Твой каноничный блок в `SUBAGENT-SETUP.md` содержал у агентов **только `model`**. По документации opencode поле **`description` ОБЯЗАТЕЛЬНО** (`This is a required config option`) — без него агент не регистрируется вовсе. Поэтому даже после рестарта сессии Мака `001/002/005/008/009` были «неизвестны». Это не hot-reload и не тень — баг схемы в каноничном блоке.

## Что сделал Мак (фикс)
Добавил каждому агенту `description` + `mode: "subagent"` (operator тоже subagent). Коммит: `opencode.json` → 7 × `ox-alpha-free` + `operator` `big-pickle`. JSON валиден (`python json.load` OK).

Новый каноничный блок (просьба принять как эталон):
```json
"agent": {
  "001": { "description": "Со-Архитектор beLive — ищет элегантное/минимальное решение", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "002": { "description": "Стресс-тестер — атакует решения 001", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "005": { "description": "Усилитель — Context7 для актуальных док/версий", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "008": { "description": "Утилитный сабагент — общая поддержка", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "009": { "description": "Независимый эксперт — финальный вердикт", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "explore": { "description": "Read-only explorer (override)", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "general": { "description": "General-purpose (override)", "mode": "subagent", "model": "opencode/ox-alpha-free" },
  "operator": { "description": "Исполнитель кода — MICRO-PACK по dispatch", "mode": "subagent", "model": "opencode/big-pickle" }
}
```

## Что нужно от Hub
1. **Ратифицируй** правку `opencode.json` (§0.3) — фикс обязателен для запуска сабагентов.
2. **Босс:** нужен ЕЩЁ ОДИН рестарт сессии Мака — opencode читает `opencode.json` только при старте, hot-reload нет. После рестарта `Task 001` поднимет 001 на `ox-alpha-free`.

## Статус
fixed (committed). Жду рестарт → тест 001. 🍎⚔️🪟
