---
tags: [P0, ship-blocker]
status: open
priority: P0
---

# 🔴 P0-2: Tempo Scenario — tempoRate Not Applied

## Проблема
Генератор объявляет `tempoRate` в listen steps, но рантайм его НЕ применяет.
Listen steps играют на 1.0x независимо от объявленного темпа.

## Влияние
- Tempo Scenario частично сломан (listen steps не замедляются)
- Пользователь слышит listen на 100% скорости, записывает на 70% — несоответствие
- Блокирует стабилизацию Tempo Scenario как product feature

## Техническая суть
```typescript
// Generator создаёт:
{ action: 'listen', tempoRate: 0.7, ... }

// Runtime НЕ применяет tempoRate к listen steps
// audioEngine.setPlaybackRate() не вызывается для listen фазы
```

## Решение
В exercise runtime (activateCurrentStep или аналог):
- При listen step → проверить `step.tempoRate`
- Если задан → вызвать `audioEngine.setPlaybackRate(step.tempoRate)`
- При завершении listen → восстановить user baseline rate

## Статус
- ✅ Generator правильно объявляет tempoRate
- ❌ Runtime не читает tempoRate из listen steps
- ❌ Нет восстановления rate после listen step

## Связанные документы
- [[tempo-scenario-current-truth]]
- [[scenario-stage-state-model]]
- [[takes-system]]

## Ответственный
Центр№ (назначается Билли)

## Открыт
2026-04-19
