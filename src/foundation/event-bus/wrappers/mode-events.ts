import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useModeStore } from '../../../stores/mode.store'
import { useStemStore } from '../../../stem/stem.store'
import { BUILTIN_STEMS, MODE_STEM_POLICIES } from '../../../stem/stemTypes'
import type { StemRole, ModeStemPolicy } from '../../../stem/stemTypes'

/** Map stem role → policy volume field (shared logic) */
function getRolePolicyVolume(role: StemRole, policy: ModeStemPolicy): number {
  switch (role) {
    case 'master': return policy.musicGroup
    case 'music': return policy.musicGroup
    case 'vocal': return policy.leadVocal
    case 'backing': return policy.backingVocal
    case 'effect': return policy.musicGroup
  }
}

const VOLUME_STORAGE_KEY = 'bl-rehearsal-volumes'

function loadRehearsalVolumesFromStorage(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.v === 2 && parsed.stemVolumes) {
      const result: Record<string, number> = {}
      for (const [key, val] of Object.entries(parsed.stemVolumes as Record<string, unknown>)) {
        const n = Number(val)
        result[key] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1
      }
      return result
    }
    if (parsed.instrumentalVolume !== undefined || parsed.vocalsVolume !== undefined) {
      const clamp = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1 }
      return {
        instrumental: clamp(parsed.instrumentalVolume ?? 1),
        vocals: clamp(parsed.vocalsVolume ?? 1),
      }
    }
    return null
  } catch { return null }
}

function applyVolumePolicy(mode: string) {
  const policy = MODE_STEM_POLICIES[mode]
  if (!policy) return
  const st = useStemStore.getState()

  if (mode === 'rehearsal') {
    const saved = loadRehearsalVolumesFromStorage()
    for (const stemId of st.loadedStems) {
      const vol = saved?.[stemId] ?? 1
      useStemStore.getState().setStemVolume(stemId, vol)
    }
  } else {
    for (const stemId of st.loadedStems) {
      const def = BUILTIN_STEMS[stemId]
      const role: StemRole = def?.role ?? 'music'
      const vol = getRolePolicyVolume(role, policy)
      useStemStore.getState().setStemVolume(stemId, vol)
    }
  }
}

export function initModeEvents(): () => void {
  const subs: Subscription[] = []

  /** Прочитать текущий режим из body class */
  const syncModeFromBody = () => {
    const body = document.body.className
    let mode: string = 'rehearsal' // default
    if (body.includes('mode-concert')) mode = 'concert'
    else if (body.includes('mode-karaoke')) mode = 'karaoke'
    else if (body.includes('mode-rehearsal')) mode = 'rehearsal'
    else if (body.includes('mode-live')) mode = 'live'
    useModeStore.getState().setMode(mode as any)
    applyVolumePolicy(mode)
  }

  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', (payload) => {
    useModeStore.getState().setMode(payload.to as any)
    document.body.className = document.body.className
      .replace(/mode-\w+/g, '')
      .trim() + ` mode-${payload.to}`
    setTimeout(() => applyVolumePolicy(payload.to), 100)
  }))

  // Initial sync — читаем body class при старте (как было в оригинальном mode.bridge.ts)
  syncModeFromBody()

  return () => subs.forEach(s => s.unsubscribe())
}
