---
tags: [P0, ship-blocker]
status: open
priority: P0
---

# 🔴 P0-1: Recording Capture Gap

## Проблема
Preview/compare audio не попадает в Program Capture Bus.
Записи не соответствуют тому что пользователь слышит.

## Влияние
- Блокирует: showcase демо, livestreaming, teacher-student сессии
- Пользователь слышит между-раундовое сравнение — в записи его нет
- Tempo Ladder: compare между раундами теряется в записи

## Техническая суть
```
СЛЫШИТ пользователь:
  Preview path → gain.connect(ctx.destination) ✅

ЗАПИСЫВАЕТСЯ:
  captureStream() → stems only ❌
  Preview → НЕ подключён к streamDestination
```

## Решение (спроектировано, не реализовано)
Program Capture Bus в AudioEngineV2:
- `getProgramCaptureStream()` — заменяет `captureStream()`
- `attachProgramSource(node, {kind})` — регистрирует preview
- `detachProgramSource(node)` — убирает при остановке
- `setCaptureMicEnabled(enabled)` — управление микрофоном

## Статус волн
- ✅ Wave R1 — Доктрина и архитектура
- ✅ Wave R2 — Engine changes (Program Capture Bus создан)
- ⏳ Wave R3 — Preview/Compare integration (НЕ ЗАВЕРШЕНО)
- ❌ Wave R4 — Visual performance validation
- ❌ Wave R5 — Testing

## Связанные документы
- [[recording-capture-sy...]]
- [[takes-system]]
- [[audio-engine]]

## Ответственный
Центр№ (назначается Билли)

## Открыт
2026-04-19
