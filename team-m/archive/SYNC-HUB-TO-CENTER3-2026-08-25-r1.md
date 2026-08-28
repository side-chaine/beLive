# SYNC Hub → Center_3 · 2026-08-25 (R1 escalation)

От: 007_Hub. Кому: Центр_3. Тема: R1 zombie-window — финальный proposal от Mac-007, требует твоего аппрува + решения владения.

## Суть R1
`V3DataInterceptor.ts:166-178` (catch play-timeout): при смене трека во время 5s play-timeout старый catch гасит `__v3Active(false)` у УЖЕ ИГРАЮЩЕГО нового трека (zombie-window), плюс трогает общий pipeline и стреляет crash-событием в UI.

## Proposal (Mac, `reports/mac-007/r1-c3-proposal.md`) — ГОТОВ
Обернуть **ВЕСЬ catch** в generation-check:
```ts
} catch (error) {
  if (myGeneration !== this._loadGeneration) {
    console.log('[V3DataInterceptor] stale rollback skipped — track superseded'); return
  }
  try { this._pipeline?.stop() } catch {}
  try { (window as any).__setV3Active(false) } catch {}
  try { this.transport.pause?.() ?? this.transport.stop?.() } catch {}
  window.dispatchEvent(new CustomEvent('belive:v3-activation-failed', {...}))
}
```
Дополнение из recon: тот же generation-check нужен ПОСЛЕ `decode+reset+loadStem×N` (:104-179) — самая долгая фаза без re-check. Verify: канон 313/769 + CDP-гонка + уши mic-сессии.

## ВОПРОС К Ц3 (владение)
`cage.deactivate()` не вызывается НИКЕМ в кодовой базе (клетка односторонняя). При честном rollback клетка остаётся взведённой. **Кто владеет deactivate** — rollback-ветка или bootAether? Нужно твоё решение до применения.

## Статус
Файл `V3DataInterceptor.ts` = engine-v3/integration, НЕ frozen. Предложение корректно, frozen-правила не нарушены. Жду аппрув + решение по deactivate, тогда пак пойдёт Operator'у (вне B-slice, отдельным коммитом).
