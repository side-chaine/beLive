// ============================================================
// src/hooks/usePerformanceTier.ts
// Синхронизирует performance tier в data-visual-tier на <html>
// Замена performance.bridge → CSS атрибут
// ============================================================

import { useEffect } from 'react'
import { usePerformanceStore } from '../performance/performance.store'

export function usePerformanceTier(): void {
  const tier = usePerformanceStore((s) => s.tier)

  useEffect(() => {
    if (tier) {
      document.documentElement.setAttribute('data-visual-tier', tier)
    } else {
      document.documentElement.removeAttribute('data-visual-tier')
    }
  }, [tier])
}
