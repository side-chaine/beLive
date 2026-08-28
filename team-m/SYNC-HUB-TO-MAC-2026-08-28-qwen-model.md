# 🔄 СИНК ХАБ→МАК · ПРИОРИТЕТ · ПОЛНАЯ конфигурация Qwen 3.8 Max Free (tokenrouter)
> От: 007_Вёдра · Маку · 2026-08-28
> Босс подключил тебе **НОВЫЙ API-ключ и URL** (скинул их тебе отдельно). Ниже — ПОЛНЫЙ конфиг «как у Вёдры». Подставь свой новый ключ/URL где помечено. Переходим на Qwen 3.8 Max Free ВСЕ, КРОМЕ operator (он остаётся на hy3-free — решение Босса).

---

## ШАГ 1 · Глобальный конфиг `~/.config/opencode/opencode.jsonc` (на Маке, per-machine)

Это файл в твоём home — он НЕ общий с Вёдрой, настраиваешь сам. Полный файл (скопируй целиком):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "tokenrouter/qwen/qwen3.8-max-free",
  "small_model": "aihubmix/ox-alpha",

  "provider": {
    "aihubmix": {
      "models": {
        "ox-alpha": {
          "name": "Ox Alpha (free)",
          "contextLength": 200000,
          "type": "language"
        }
      }
    },
    "tokenrouter": {
      "type": "openai",
      "options": {
        "apiKey": "{env:OPENAI_API_KEY}",
        "baseURL": "https://api.tokenrouter.com/v1"
      },
      "models": {
        "qwen/qwen3.8-max-free": {
          "name": "Qwen 3.8 Max Free",
          "contextLength": 8192,
          "type": "language"
        }
      }
    }
  }
}
```

⚠️ **Если Босс дал ДРУГОЙ baseURL** — замени `https://api.tokenrouter.com/v1` на его URL. `small_model` можешь оставить свой или убрать.

---

## ШАГ 2 · Ключ в переменную окружения

```bash
# в ~/.zshrc на Маке:
export OPENAI_API_KEY="<НОВЫЙ tokenrouter-ключ, что скинул Босс>"
```
→ `source ~/.zshrc` (или перезапуск терминала).

⚠️ Имя переменной — `OPENAI_API_KEY` (так wired у Вёдры: конфиг читает `{env:OPENAI_API_KEY}`). Если Босс сказал иное имя переменной — поменяй и в конфиге строку `"apiKey": "{env:...}"` соответственно.

---

## ШАГ 3 · ⚠️ ГЛАВНОЕ: модель каждого агента живёт в `.opencode/agent/*.md` (frontmatter)

ВЫЯСНЕНО опытным путём (Вёдра, 28.08): **frontmatter md-файлов ПЕРЕКРЫВАЕТ `opencode.json`**. Если поменять только json — модель НЕ сменится. Править надо именно md-файлы.

В `.opencode/agent/` в файлах `001.md, 002.md, 005.md, 007.md, 008.md, 009.md, arch-scout.md, gateway-scout.md, sync-scout.md` заменить строку frontmatter:
```
model: opencode/hy3-free   →   model: tokenrouter/qwen/qwen3.8-max-free
```

⚠️ **ИСКЛЮЧЕНИЯ:**
- `operator.md` — **ОСТАВИТЬ `opencode/hy3-free`** (решение Босса).
- `*.md.high` (001.md.high, 002.md.high, …) — **НЕ ТРОГАТЬ**: это близнецы-эскалации, намеренно на других/более сильных моделях (kimi-k3, glm-5.1/5.2, deepseek-v4-flash, kimi-k2.6).

Команда (в корне репо; **BSD-sed для macOS** — обрати внимание на `''` после `-i`):
```bash
for f in 001 002 005 007 008 009 arch-scout gateway-scout sync-scout; do
  sed -i '' 's|^model: opencode/hy3-free$|model: tokenrouter/qwen/qwen3.8-max-free|' ".opencode/agent/$f.md"
done
```

> Примечание по шарингу: git отслеживает только `001/002/005/007/009/operator.md`; `008.md` и скауты (`arch/gateway/sync-scout.md`) — untracked, у тебя свои копии. Если репо шарится через sshfs — часть правок Вёдры уже видна, но проверь каждый файл командой `grep -Hn '^model:' .opencode/agent/*.md`.

---

## ШАГ 3б · Проектный `opencode.json` (в репо beLive) — вторично, для порядка

Полный файл «как у Вёдры» (все агенты на Qwen, КРОМЕ operator):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "007",
  "subagent_depth": 1,
  "instructions": ["AGENTS.md", "team-m/prompts/SHARED.md"],
  "agent": {
    "001": { "description": "Со-Архитектор beLive — ищет элегантное/минимальное решение", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "002": { "description": "Стресс-тестер — атакует решения 001, ищет краевые случаи", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "005": { "description": "Усилитель — подключает Context7 для актуальных док/версий", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "008": { "description": "Утилитный сабагент — общая поддержка/связка", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "009": { "description": "Независимый эксперт — финальный вердикт по задаче", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "explore": { "description": "Read-only explorer (built-in override)", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "general": { "description": "General-purpose subagent (built-in override)", "mode": "subagent", "model": "tokenrouter/qwen/qwen3.8-max-free" },
    "operator": { "description": "Исполнитель кода — применяет MICRO-PACK/патчи по dispatch Hub", "mode": "subagent", "model": "opencode/hy3-free" }
  },
  "model": "tokenrouter/qwen/qwen3.8-max-free"
}
```

---

## ШАГ 4 · ПОЛНЫЙ перезапуск процесса opencode + проверка

**Конфиг (и json, и md) кэшируется при старте процесса и НЕ перечитывается на лету.** Без полного рестарта (выйти из TUI / прибить процесс и запустить заново) модель не сменится — проверено Вёдрой: правки на диске есть, а живые агенты показывали старое до рестарта.

Проверка после рестарта: диспатч-зонд любого агента (кроме operator) → `MODEL_ID: tokenrouter/qwen/qwen3.8-max-free`; operator → `opencode/hy3-free`.

---

## ИТОГ-ЧЕКЛИСТ МАКА
- [ ] `~/.config/opencode/opencode.jsonc`: provider.tokenrouter + model (ШАГ 1), НОВЫЙ URL от Босса.
- [ ] `OPENAI_API_KEY` = НОВЫЙ tokenrouter-ключ от Босса (ШАГ 2).
- [ ] `.opencode/agent/*.md` frontmatter: Qwen у 001/002/005/007/008/009 + 3 скаутов; **operator.md = hy3-free**; `*.md.high` НЕ трогать (ШАГ 3 — ГЛАВНОЕ).
- [ ] Проектный `opencode.json`: все на Qwen, КРОМЕ operator (ШАГ 3б).
- [ ] ПОЛНЫЙ перезапуск процесса → проверка MODEL_ID (ШАГ 4).
- [ ] Отписаться Вёдре: «Мак на Qwen 3.8 Max Free» (+ если имя env/URL изменил).

— 007_Вёдра. Приоритет: переход на Qwen 3.8 Max Free везде, КРОМЕ operator. 🚀