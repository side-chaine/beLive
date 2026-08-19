// ============================================================
// src/audio/engine-v3/integration/V2AudioCage.ts
// MP-18: Zombie Kill Switch — внешняя клетка для V2.
//
// V2 (frozen) сопротивляется собственному заглушению через
// _restoreSilencedStems() → setTargetAtTime(SOUND_VOL).
// Вместо борьбы с внутренней логикой V2 — надеваем клетку
// снаружи через публичный V2Adapter API.
//
// Ключевое отличие от предыдущих попыток:
//   - Используем pause() вместо stop() — не триггерит
//     _restoreSilencedStems() → нет gain automation
//   - Watchdog перепроверяет volumes через публичный API
//   - Не требуется доступ к AudioParam (обходим ограничения
//     PUBLIC_GETTERS, где нет stems)
// ============================================================

import { V2Adapter } from '../V2Adapter'

const STEM_IDS = ['instrumental', 'vocals', 'drums', 'bass', 'keys', 'guitar', 'backing', 'other']

export class V2AudioCage {
  private _active = false
  private _pollHandle: number | null = null

  /** Активировать клетку: заглушить V2 и удерживать.
   *  Всегда перезануляет V2 и перезапускает watchdog, даже если уже активна.
   *  Нужно для track change: V2 перестраивает routing (_rebuildFullRouting)
   *  при загрузке нового трека, создавая новые gain nodes с default gain=1.0.
   *  Повторный activate() перехватывает их сразу после _loadPipeline(). */
  activate(): void {
    // Всегда выполняем silencing, даже если уже активны — V2 мог перестроить routing
    const wasActive = this._active
    this._active = true

    if (wasActive) {
      console.log('[V2Cage] 🔄 Re-activating — re-zero V2 gains (routing may have changed)')
    } else {
      console.log('[V2Cage] 🧟 Activating — pause V2 + zero all gains')
    }
    // Останавливаем старый watchdog если был
    if (this._pollHandle !== null) {
      clearInterval(this._pollHandle)
      this._pollHandle = null
    }

    // 1. Pause V2 (НЕ stop! stop → _restoreSilencedStems → setTargetAtTime → gain restoration)
    //    pause() останавливает воспроизведение без триггера automation
    this._safeDelegate('pause')
    this._safeDelegate('setStemsEnabled', false)

    // 2. Zero all volume layers
    this._zeroAllVolumes()

    // 3. Watchdog: V2 может попытаться восстановить gain через
    //    _hotPlugStem (Phase 2), autoplay timer, или loop jump.
    //    Перепроверяем каждые 500ms × 3 = 1.5s.
    let checks = 0
    this._pollHandle = window.setInterval(() => {
      if (!this._active) return
      this._zeroAllVolumes()
      if (++checks >= 3) {
        clearInterval(this._pollHandle!)
        this._pollHandle = null
        console.log('[V2Cage] ✅ Watchdog отработал 3 прохода — остановлен')
      }
    }, 500)

    console.log('[V2Cage] ✅ Cage active — V2 silenced')
  }

  /** Деактивировать клетку: восстановить V2 для legacy-режима */
  deactivate(): void {
    if (!this._active) return
    this._active = false

    // Останавливаем watchdog
    if (this._pollHandle !== null) {
      clearInterval(this._pollHandle)
      this._pollHandle = null
    }

    // Восстанавливаем V2 volumes для возможного возврата
    STEM_IDS.forEach(id => {
      this._safeDelegate('setStemVolume', id, 1)
      this._safeDelegate('setStemMute', id, false)
    })
    this._safeDelegate('setInstrumentalVolume', 1)
    this._safeDelegate('setVocalsVolume', 1)
    this._safeDelegate('setStemsEnabled', true)

    console.log('[V2Cage] 🔓 Cage deactivated — V2 restored')
  }

  get active(): boolean {
    return this._active
  }

  // ── private ──

  private _zeroAllVolumes(): void {
    for (const id of STEM_IDS) {
      this._safeDelegate('setStemVolume', id, 0)
      this._safeDelegate('setStemMute', id, true)
    }
    this._safeDelegate('setInstrumentalVolume', 0)
    this._safeDelegate('setVocalsVolume', 0)
    this._safeDelegate('setStemsEnabled', false)
  }

  private _safeDelegate(method: string, ...args: any[]): void {
    try {
      V2Adapter.getInstance().delegateSync(method as any, ...args)
    } catch {
      // V2 not available — ignore silently
    }
  }
}
