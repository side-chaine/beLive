# BOOST-005 · Верификация документацией и исходниками (агент 005, Бустер) · 2026-08-25

> Полный отчёт без изменений. Источники: opencode.ai/docs, схема config.json, исходники anomalyco/opencode (dev), Context7 (/websites/opencode_ai, /anomalyco/opencode, /anthropics/skills).

## 1. ФАКТЫ

### Q1. Семантика `{file:}`
- Синтаксис официальный: `"prompt": "{file:./prompts/code-review.txt}"`. Путь относителен каталогу конфига. Легален в любом месте конфига. Источник: https://opencode.ai/docs/agents/#prompt , https://opencode.ai/docs/config/#variables--files
- **Отсутствующий файл → ОТКАЗ ЗАПУСКА** для проектного конфига: `InvalidError: bad file reference ... does not exist` (ENOENT), загрузка обёрнута в `Effect.orDie` → процесс умирает на старте. Источник: raw variable.ts (packages/opencode/src/config/variable.ts).
- ⚠️ **Нюанс:** глобальный конфаг (`~/.config/opencode/`) грузится с `orElseSucceed({})` + лог «failed to load global config, using defaults» → битый `{file:}` в глобальном = тихая потеря ВСЕГО глобального конфига, старт продолжается. Проектный = жёсткое падение.
- **Пустой существующий файл → ТИХИЙ ПУСТОЙ ПРОМТ**: `.trim()` подставляется как есть, валидации непустоты нет → агент работает без роли незаметно.
- Бонус: `{env:VAR}` при неустановленной переменной → пустая строка (задокументировано).

### Q2. `instructions[]`
- Инжектится ВСЕМ агентам, включая primary и субов. Из исходников: системный промт = `[agent.info?.system, system.baseline]`; комментарий разработчиков: «There is no per-agent filtering or isolation of AGENTS.md instructions». runLoop() грузит instruction.system() в пути, общем для всех сессий, включая субагентские.
- Доки: «All instruction files are combined with your AGENTS.md»; поддерживаются globs и удалённые URL (fetch с таймаутом 5 сек). Источник: https://opencode.ai/docs/rules/#custom-instructions
- **Механизма исключения конкретного агента НЕТ.**

### Q3. `permission` per-agent
- Синтаксис: шорткат `"allow"|"ask"|"deny"` ИЛИ объект `{glob: action}`. Ключи: read, edit (покрывает write/edit/apply_patch), glob, grep, list, bash, task, external_directory, todowrite, webfetch, websearch, lsp, skill, question, doom_loop. Последнее совпадение правила побеждает.
- Официальный пример ровно нашего кейса: план-агент `"permission": {"edit": "deny", "bash": "deny"}`.
- Субагенты: да; дочерний агент НАСЛЕДУЕТ родительские DENY-правила; todowrite запрещён субам по умолчанию. Источник: subagent-permissions.ts.
- `task`-пермишены с glob'ами: `"*": "deny"` + точечные allow → при deny субагент удаляется из описания Task-инструмента целиком. Нюанс: юзер всегда может через `@`. Дефолт — allow всё.

### Q4. `skills.paths` / `skills.urls`
- Подтверждены схемой и исходником discoverSkills: сканируются `~/.claude/skills/**/SKILL.md`, `~/.agents/skills/**/SKILL.md`, `.opencode/{skill,skills}/**/SKILL.md`, кастомные paths (несуществующий путь → мягкий warning, не падение); urls → discovery.pull скачивает и сканирует.
- Формат скилла: `<имя>/SKILL.md`, YAML-frontmatter name (regex, обязан совпадать с папкой) + description. Формат идентичен Anthropic Agent Skills — чужие библиотеки подключаются без адаптации.

### Q5. `temperature` / `steps`
- Официальные диапазоны: 0.0–0.2 focused/deterministic («ideal for code analysis and planning»); 0.3–0.5 balanced; 0.6–1.0 creative. Дефолт: обычно 0 (Qwen — 0.55).
- steps: лимит итераций, после которого агент получает специальный промт «суммаризуй сделанное + назови оставшееся» (управляемое сворачивание, не обрыв). Не задан → безлимит. maxSteps deprecated.
- Связь steps↔compaction в доках НЕ описана; compaction настраивается отдельно (auto/prune/reserved/tail_turns/preserve_recent_tokens).

### БОНУС-НАХОДКИ (нет ни в одном из трёх документов команды)
1. **Markdown-агенты**: `.opencode/agents/<name>.md` — имя файла = имя агента, тело = системный промт напрямую, frontmatter несёт mode/model/temperature/permission. Устраняет прослойку `{file:}`.
2. **`hidden: true`** — субагент исчезает из @-меню, остаётся доступен модели через Task.
3. **`experimental.continue_loop_on_deny`**, **`experimental.primary_tools`**.
4. **`opencode debug config`** — показывает резолвленный конфиг (все слои слиты) = готовый претест подстановок.
5. Слои конфига мержатся, массивы instructions конкатенируются с дедупликацией; Managed Settings (/etc/opencode/) — админ-замок выше юзерских конфигов.
6. `small_model` (служебные title/summary), `subagent_depth: 0` (полный запрет спавна), `doom_loop`, `tool_output.max_lines/max_bytes`.

## 2. ВОЗМОЖНОСТИ (5 усилений)
1. **Markdown-агенты как несущая конструкция** → риск «битой ссылки {file:}» снимается структурно: файл промта и определение агента — один файл; битая ссылка невозможна по построению; permission/temperature во frontmatter без JSON-экранирования.
2. **FROZEN-ZONE и канон → скилл вместо инструкций** → lazy-loading: тяжёлые секции не сидят в системном промте каждого агента, грузятся по требованию. Лечит вытеснение контекста 007 и статичность цифр.
3. **Топология цепочки железом**: 007 → `"permission": {"task": {"*": "deny", "<белый список>": "allow"}}`, все сабы `hidden: true`, `subagent_depth: 1` → граф вызовов фиксирован движком.
4. **Эскалация без рестарта**: пары близнецов (`005` и `005-hi` — та же роль, .high-модель) → переключение диспатчем, ноль правок конфига, ноль смерти сессии.
5. **Претест штатными средствами**: `OPENCODE_CONFIG_CONTENT` (инлайн-конфиг) + `opencode debug config` до старта; ролевое эхо (`@<агент>: назови роль одной строкой`) после.

## 3. ОБХОД
- Исключить агента из instructions[] нельзя → обход: (а) `disable: true` ненужным; (б) раскладка: SHARED — только домен/FROZEN/правила, все ФОРМАТЫ — per-agent; (в) тяжёлое — в скиллы (lazy).
- Пустой файл = тихий пустой промт → претест grep'ом маркеров (первая строка промт-файла = маркер роли) + ролевое эхо после рестарта.
- steps↔compaction муфты нет → `compaction.reserved` с запасом + `steps` с запасом; при упоре в лимит агент сам суммаризует.

## 4. НЕ НАЙДЕНО
- Поведение ПУСТОГО `{file:}`-файла в доках отсутствует (добыто из исходника variable.ts, dev-ветка — зафиксировать версию opencode).
- Механизм исключения из instructions[] — не существует.
- Связь steps с compaction — не документирована.
- Формат индекса .well-known/skills/ для skills.urls — только пример из схемы; для продакшн-URL нужна живая проба.
