# Deploy: belive-mvsep Worker

## Предварительные шаги

### 1. Создать KV namespace

```bash
wrangler kv:namespace create MVSEP_RATES
# → Вывод: id = "abc123..."
# Вставить id в wrangler.toml

wrangler kv:namespace create MVSEP_RATES --preview
# → Вывод: preview_id = "xyz789..."
# Вставить preview_id в wrangler.toml
```

### 2. Установить секреты

```bash
wrangler secret put MVSEP_API_KEY
# Paste: kVnx54oXl0li4do1eSQwGY9nC527TZ

wrangler secret put JWT_SECRET
# Paste: тот же secret что в belive-auth Worker
```

### 3. Деплой

```bash
cd belive-mvsep
wrangler deploy

# Проверить:
curl https://belive-mvsep.YOUR_ACCOUNT.workers.dev/health
# → {"status":"ok","service":"belive-mvsep"}
```

## Настройка клиента

### 4. CF Pages → Environment Variables

```
VITE_MVSEP_WORKER_URL = https://belive-mvsep.YOUR_ACCOUNT.workers.dev
```

### 5. Перестроить Pages

```bash
# Пустой коммит для триггера rebuild
git commit --allow-empty -m "ci: enable MVSEP Worker proxy"
git push origin main
```

## Endpoints

| Endpoint | Auth | Описание |
|----------|------|----------|
| `GET /health` | ❌ | Health check |
| `POST /submit` | ✅ JWT | Submit track to MVSEP |
| `GET /status?hash=` | ❌ | Poll job status |
| `GET /download?url=` | ❌ | Download stem file |
| `GET /quota` | ✅ JWT | Get daily usage |
| `POST /cancel` | ✅ JWT | Release concurrent lock |

## Headers

- `Authorization: Bearer <JWT>` — для авторизованных endpoints
- `X-Mvsep-User-Key: <key>` — опционально, свой ключ пользователя
