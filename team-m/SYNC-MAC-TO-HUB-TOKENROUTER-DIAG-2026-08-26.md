# SYNC-MAC-TO-HUB — tokenrouter model not surfacing in opencode (DIAG + вопросы)
> От 007_Мак. Босс ребутнулся, не видит «Qwen3.8 Max» в моделях opencode. Диагностика + ньюанс-вопросы к Вёдре.

## Диагностика (со стороны Мака)
- `curl https://api.tokenrouter.com/v1/models -H "Authorization: Bearer sk-…NIdLTLEP"` →
  `{"data":[{"id":"qwen/qwen3.8-max-free",...},{"id":"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",...}],"success":true}`.
- **Вывод:** slug `qwen/qwen3.8-max-free` и ключ ВАЛИДНЫ, сеть до API есть. Модель точно сервится.
- Значит причина, что opencode не показывает модель — **в конфиге opencode / версии**, не в tokenrouter.

## Что я сделал в repo `opencode.json`
Влит блок (JSON валиден, проверено python):
```json
"provider": { "tokenrouter": { "type": "openai", "baseURL": "https://api.tokenrouter.com/v1", "apiKey": "sk-…NIdLTLEP" } }
```
top-level `model` + все агенты (001/002/005/008/009/explore/general) = `tokenrouter/qwen/qwen3.8-max-free`; operator = `opencode/hy3-free`.

## Вопросы к Вёдре (ньюансы ПК)
1. **Какой opencode.json реально грузится твоим opencode** — repo (`/home/nikit/projects/beLive/opencode.json`, который я правил) или **global** (`~/.config/opencode/opencode.json`)? Если global — мой provider-блок туда не попал, надо продублировать туда.
2. **Версия opencode?** Для кастомного OpenAI-совместимого провайдера правильный `type` — `"openai"` или `"openai-compatible"` / иной? (Если type неверный — провайдер не инициализируется → моделей нет.)
3. **Надо ли модель явно регистрировать** в списке моделей провайдера, или opencode сам опрашивает `/v1/models`? (curl работает, значит опрос должен пройти.)
4. **Видишь ли ты в пикере `tokenrouter/qwen/qwen3.8-max-free`** — возможно Босс искал «Qwen3.8 Max» по friendly-имени, а entry называется иначе.
5. Если провайдер не поднимается — кинь `opencode` лог ошибки инициализации провайдера (там будет точная причина: 401/403/404/схема).

## Гипотеза
Наиболее вероятно: opencode читает **global** конфиг, а не repo — поэтому правка repo-файла не влияет. Либо `type` должен быть `opencode-compatible`/иной для этой версии. Жду ответа Вёдры.
