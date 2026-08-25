---
agent: mac-007
task: r1-c3-proposal
status: ready-for-c3
updated: 2026-08-25T17:30:00+00:00
---
# PROPOSAL Ц3 · R1: generation-check на ВЕСЬ rollback-catch

## Контекст
`V3DataInterceptor.ts:166-178` (catch play-timeout): при смене трека во время 5s play-timeout
старый catch гасит `__v3Active(false)` у УЖЕ ИГРАЮЩЕГО нового трека (zombie-window),
плюс трогает общий pipeline и стреляет crash-событием в UI.

## Фикс (обернуть ВЕСЬ catch, не только запись флага)
```ts
// в начале async load: const myGeneration = this._loadGeneration
} catch (error) {
  if (myGeneration !== this._loadGeneration) {
    console.log('[V3DataInterceptor] stale rollback skipped — track superseded')
    return                                   // ⬅ НИЧЕГО не делать: новый лад владеет pipeline/флагом/UI
  }
  try { this._pipeline?.stop() } catch {}                          // :168 — под гардом
  try { (window as any).__setV3Active(false) } catch {}            // :169 — под гардом
  try { this.transport.pause?.() ?? this.transport.stop?.() } catch {}
  window.dispatchEvent(new CustomEvent('belive:v3-activation-failed', {...}))  // :176 — под гардом
}
```

## Дополнение из recon (sync-драфт)
1. Тот же generation-check нужен ПОСЛЕ decode+reset+loadStem×N (:104-179) — самая долгая фаза
   без re-check: протухший лад успевает активировать клетку и запустить старый трек.
2. `cage.deactivate()` не вызывается НИКЕМ в кодовой базе — клетка односторонняя;
   при stale-skip это спасает, но при честном rollback клетка остаётся взведённой → вопрос Ц3:
   кто владеет deactivate (rollback-ветка? bootAether?).

## Verify
Канон 313/769; CDP: старт лада A → немедленно лад B во время play-timeout → B играет,
флаг не падает, crash-modal нет; уши: mic-сессия (автопауза/RTL).
