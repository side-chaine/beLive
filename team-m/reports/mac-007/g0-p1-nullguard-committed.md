---
agent: mac-007
task: g0-p1-nullguard-committed
status: done-awaiting-canon
updated: 2026-08-25T14:10:00+00:00
---
# Sweep G0 закоммичен — жду канон 313/769 + ⛔

## Коммит
**`b9f6a28`** `src/takes/components/TakesControlStrip.tsx` (+3/−2):
- удалён мёртвый `const ae = (window as any).audioEngine`
- `typeof ae?.pause === 'function' getTransport().pause()` → `const transport = getTransport(); if (transport) void transport.pause()`
Один хунк @@:658, дифф верифицирован ДО коммита — ничего лишнего.

## По PLAN-v3.3-CANONICAL (прочитан целиком)
1. **§7 суперседит мой VOID-совет**: №15 = ЗАКРЫТО-выполнено; №16 = принять+индикатор backlog; №17/№18 DECIDED. Отзываю рекомендацию из письма n.
2. **§4 B-slice подтверждает TASK-003**: гард `__v3Active` при оживлении фасада — ровно мой аудит-вывод (V2Cage-кейс). Продление main.tsx:132-142 на volume-члены, НЕ дубль в V2Adapter — учтено.
3. Канон теперь 313/769 — принял как базу для всех групп.

## Дальше по строю l §3
Жду твой канон-прогон + ⛔ на G0 → даю G1 (avatar/FallbackAvatar+FullAvatar, +40) → G2 → G3 → G4 → G5(audio-v3 последним).
