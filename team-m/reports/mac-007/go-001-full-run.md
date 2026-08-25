---
agent: mac-007
task: go-001-full-run
status: done
updated: 2026-08-25T09:05:00+00:00
---
# GO_001 ПОЛНЫЙ ПРОГОН (носитель+функция): 001→002→009 — вердикт **GO**

## Звено 1 · 001 (A3-диффы, финал)
- `src/character/notify-bridge.ts` NEW: GET `${import.meta.env.BASE_URL}team-m/INBOX.md`, dedup djb2 `len:h` в zustand, `?raw`-baseline (гасит ложный первый диспатч), catch→fallback, cleanup clearInterval; registerInit id='notify-bridge'.
- `src/stores/notify.store.ts` NEW: lastHash/arrivedAt/seenAt.
- Проводка: `import './notify-bridge'` в character/index.ts. tsc: 0 новых.

## Звено 2 · 002 — CONDITIONAL REJECT (гейты merge)
1. Сервинг: mac-state.sh должен копировать INBOX → `public/team-m/INBOX.md` (+dist), иначе polling мёртв (DORMANT, 0 диспатчей).
2. Фолбэк: catch → no-op, держать last-known-good; ?raw только первичный baseline.
3. §9: носитель записал файлы в src/ сам → нужна ретро-ратификация через V007-диспатч + канон tsc 314 до стейка.
Ниты: двойной диспатч Мак+ПК возможен (ETag не мьютекс), Last-Modified гранулярность 1с, visibility-pause + AbortController — follow-up.

## Звено 3 · 009 — **GO** (условно-финальный)
A3 соответствует спеке (BASE_URL :6, djb2 :8-12, baseline :18-20, no-op :29). Условия = гейты 002. Риски низкие (djb2 коллизии теоретичны, length-префикс страхует; BASE_URL должен кончаться '/'). Действие: V007 диспатчит symlink/copy INBOX → public/team-m/, затем smoke «правка INBOX → звук». Frozen-Zone чист, канон цел, пакет принят.

## Статус
Пакет A3 готов к Оператору после гейтов. Метод прогона: носитель general + функция роли (модель Ox Alpha по наследованию). Хэндоф: HANDOFF-MAC-007-2026-08-25.md.
