# LRC Parser Service
**Status:** ✅ PRODUCTION
**File:** `src/services/lrc-parser.service.ts` (27 строк)
**Created:** TC-002 (2026-06-16)
**Canonical entry point:** for all LRC parsing operations

---

## Назначение

Унифицированная точка входа для парсинга LRC-разметки. Заменяет прямой вызов `parseLrcString` из разных модулей.

## Exports

| Функция | Назначение |
|---------|------------|
| `parseLrcFile(content: string): LrcLine[]` | Парсинг LRC-строки в массив `LrcLine[]` (содержит time, text) |
| `parseLrcString(content: string): LrcLine[]` | @deprecated — используйте `parseLrcFile` |

## Интеграция

- `auto-lyrics.service.ts` — использует как основной парсер
- Другие LRC-потребители должны импортировать отсюда

## Deprecated

`parseLrcString` из `parsing.service.ts` — больше не импортировать напрямую. Все новые потребители — через `lrc-parser.service.ts`.
