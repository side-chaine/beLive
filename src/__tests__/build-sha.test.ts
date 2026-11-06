// @PR-1 build-sha: гарантируем, что сборка несёт непустой идентификатор для приёмки ДО/ПОСЛЕ на J8.
// Глобал __BUILD_SHA__ инжектируется через vite/vitest define (см. vite.config.ts / vitest.config.ts).
import { describe, expect, it } from 'vitest'

describe('build-sha', () => {
  it('__BUILD_SHA__ is a non-empty string injected by the build define', () => {
    expect(typeof __BUILD_SHA__).toBe('string')
    expect(__BUILD_SHA__.length).toBeGreaterThan(0)
  })
})
