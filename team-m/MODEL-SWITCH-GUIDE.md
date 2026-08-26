# 🔧 ГАЙД: смена модели у агентов OpenCode (Far/Near Light)
> Автор: 007_Mac · 2026-08-26 · зеркало в REGISTRY §5. Сохранён потому, что «иногда модели не могут поменять настройки тут в опенкод» — свитч делает сам Босс/Хаб руками по этому гайду.

## СИМПТОМ (почему нужен гайд)
Сабагенты **НАСЛЕДУЮТ live-модель сессии 007**, пока не задан top-level `model`. То есть когда 007 сидит на Hy3, и 002 видит Hy3; когда 007 на Ox Alpha — 002 тоже Alpha, ДАЖЕ если в `agent.model` прописан другой id. Фронт-маттер `opencode-go/ox-alpha-free` в `.opencode/agent/*.md` **переигрывается** JSON-конфигом (эмпирически: сабы шли как `x-preview-f-free` из JSON независимо от фронт-маттера). Также `ox-alpha-free` и `opencode-go/ox-alpha-free` **НЕ существуют** в каталоге — корень былого «Upstream Endpoint is unavailable».

## ПРОЦЕДУРА (для Босса/Хаба)
1. **`opencode.json`** (в репо `~/beLive-pc`, он же через симлинк `~/.config/opencode/opencode.json`):
   - top-level `"model"` → цель (напр. `opencode/hy3-free` = Hy3 Free OpenCode Zen).
   - каждый per-agent `"model"` (001/002/005/008/009/explore/general) → та же цель.
2. **`.opencode/agent/*.md`** frontmatter `model:` → та же цель (консистентность; JSON всё равно побеждает).
3. **`operator`** оставить `opencode/big-pickle` (движок применения кода) — меняем только по прямому слову Босса.
4. **Симлинк** (чтобы Warp стартовал из любой папки и читал репо-конфиг):
   `ln -sf ~/beLive-pc/opencode.json ~/.config/opencode/opencode.json`
5. **ОБЯЗАТЕЛЬНО РЕСТАРТ** opencode-процесса — конфиг читается при старте, живой сессии не хватает.

## ВЕРИФИКАЦИЯ (CHAIN-SMOKE)
После рестарта спавн 002 и 008, спросить: «какой ты model id?». Если `opencode/hy3-free` (цель) — независимо от сессии, GREEN. Если зеркалит сессию 007 — свитч не вступил (забыли рестарт или симлинк).

## АКТУАЛЬНЫЙ СНЭПШОТ (26.08)
- Все агенты = `opencode/hy3-free`; operator = `opencode/big-pickle`. CHAIN-SMOKE 4/4 GREEN.
- Изменение shared-поля (§0.3 REGISTRY) логируется в REGISTRY §5 + строка в INBOX.
