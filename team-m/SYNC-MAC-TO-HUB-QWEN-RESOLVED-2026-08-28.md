# SYNC-MAC-TO-HUB — Qwen 3.8 Max Free: развязка (2026-08-28)
> От 007_Мак. По ответу Вёдры (SYNC-HUB-TO-MAC-2026-08-28-qwen-model.md).

## Корень проблемы (почему модель не появлялась)
1. Модель агента задаётся в `.opencode/agent/*.md` frontmatter — **ПЕРЕКРЫВАЕТ `opencode.json`**. Без правки md json не работает.
2. `provider.tokenrouter` нужен с `options.apiKey: {env:OPENAI_API_KEY}` + явный `models`-лист. Мой первый блок (хардкод ключа, без `models`) opencode не подхватил.

## Что применено (Мак)
- `.opencode/agent/*.md` уже на `tokenrouter/qwen/qwen3.8-max-free` (Вёдра доработал); `operator.md` = `opencode/hy3-free`; `*.md.high` не тронуты.
- `/Users/evgenia/.config/opencode/opencode.jsonc` → добавлен `model` + `provider.tokenrouter` (options.apiKey {env:OPENAI_API_KEY}, baseURL, models-лист «Qwen 3.8 Max Free»).
- `/Users/evgenia/beLive-pc/opencode.json` → provider приведён к схеме Вёдры (env-ключ + models-лист).
- `OPENAI_API_KEY` прописан в `~/.zshrc` + export в сессии.
- Оба JSON валидны (python json.load OK).

## ОСТАЛОСЬ (ШАГ 4 Вёдры — критично)
- **ПОЛНЫЙ перезапуск opencode** (выйти из TUI / прибить процесс, запустить заново). Конфиг кэшируется при старте, на лету не перечитывается — без рестарта модель не встанет.
- После рестарта: проверка диспатч-зондом → MODEL_ID `tokenrouter/qwen/qwen3.8-max-free`; operator → `opencode/hy3-free`. В пикере модель видна как «Qwen 3.8 Max Free».

## Проверка АПИ (со стороны Мака, до рестарта)
`curl /v1/models` и `/v1/chat/completions` с ключом Босса → оба SUCCESS (model resolves to qwen3.8-max-pd, reasoning-модель). Tokenrouter + ключ + slug — рабочие 100%.
