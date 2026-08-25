# SCHEMA-FINDINGS · Верификация схемы opencode (007, webfetch https://opencode.ai/config.json) · 2026-08-25

## Вердикт по спорному полю (факт уровня схемы)

`AgentConfig` properties: `model`, `variant`, `temperature`, `top_p`, **`prompt` (string)**, `tools` (@deprecated), `disable`, `description`, `mode`, `hidden`, `options`, `color`, `steps`, `maxSteps`(@deprecated), `permission`.

- ❌ Поля `instructions` в AgentConfig **НЕТ** → оба предложения Центра_5 («per-agent instructions») нерабочие как написаны. Поле будет проигнорировано парсером.
- ✅ Per-agent системный промт = поле **`prompt`** (string). Синтаксис `{file:./path}` — документированный способ загрузки из файла (подтверждено агентом 001 через Context7, /websites/opencode_ai).
- ✅ Топ-левел `instructions` (array of strings, файлы/globs) существует и инжектится всем агентам — сюда кладётся общий домен.

## БОНУС-РЫЧАГИ из схемы (никем из трёх источников не предложены)

| Рычаг | Что даёт beLive |
|---|---|
| **per-agent `permission`** | ЖЕЛЕЗНАЯ привязка ролей: 002/009/explore → `edit: deny` (read-only гарантирован движком, а не промптом); operator → `bash/edit: allow`; `task: deny` сабам (запрет вложенных субагентов). Промпт можно обойти, permission — нельзя. |
| **per-agent `temperature` / `top_p`** | operator (слепой исполнитель) → низкая temperature ≈ 0.1–0.2 (детерминизм); 005 (бустер-фантазёр) → выше ≈ 0.8 (креатив); 009 (суд) → минимальная (строгость). |
| **per-agent `steps`** | Лимит итераций агента = контроль стоимости и защита от зацикливания free-модели (напр. explore 10, operator 25, 001 30). |
| **топ-левел `skills.paths` / `skills.urls`** | Официальный механизм «подтянуть прокаченные скиллы» (просил Босс): доп. папки скиллов и URL-источники (.well-known/skills/). |
| **`subagent_depth`** | Контроль вложенности сабов (default 1 — сабы не могут спавнить сабов). |
| **`small_model`** | Дешёвая модель для служебных задач (titles/summaries) — экономия пула Ox Alpha. |
| **`variant`** (per-agent) | Выбор варианта модели без смены модели. |

## Следствие для синтеза
Финальный конфиг = скелет 001 (`prompt: {file:}` + топ-левел instructions[]) **+** жёсткие JSON/XML-форматы вывода Центра_5 как секция ФОРМАТ в файлах промтов **+** permission/temperature/steps из этой находки.
