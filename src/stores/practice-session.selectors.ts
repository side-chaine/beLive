import { useAudioStore } from './audio.store'
import { useModeStore } from './mode.store'
import { useLoopStore } from './loop.store'
import { useBlocksStore } from './blocks.store'
import { useStemStore } from '../stem/stem.store'

/** Selector-facade для practice-session — централизует 5 кросс-зависимостей */
export const practiceSelectors = {
  /** Можно ли начать практику? (все условия) */
  canStartPractice: (): boolean => {
    const audio = useAudioStore.getState()
    const mode = useModeStore.getState()
    const blocks = useBlocksStore.getState()
    return audio.isPlaying && mode.mode === 'rehearsal' && blocks.blocks.length > 0
  },

  /** Получить текущий loop-сегмент для практики */
  getPracticeLoop: () => {
    const loop = useLoopStore.getState()
    return loop.isLooping ? { start: loop.loopStartTime, end: loop.loopEndTime } : null
  },

  /** Получить доступные стемы для практики */
  getAvailableStems: () => {
    const stem = useStemStore.getState()
    return stem.loadedStems.filter((id: string) => stem.stemVolumes[id] > 0)
  },
}
