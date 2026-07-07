# Avatar Visual Engine v3 — Architecture Document

**Дата:** 2026-06-25  
**Статус:** ✅ DEPLOYED  
**Архитектор:** 001 (CEO Co-Architect)  
**Верификация:** 009 PASS  

---

## 1. Executive Summary

Avatar Engine — Living Proxy (State Machine). Отражает состояние системы, не живёт своей жизнью.
- **Парадигма:** Аватар = State Machine, `<div class="av-container" data-state="sing">` — единственный атрибут управления
- **Tier Gate:** `performance.presets.ts` → `allowAvatar: false` (FallbackAvatar) / `true` (FullAvatar)
- **6 состояний:** idle, happy, listening, sing, error, reactive
- **Рендер:** Inline SVG + CSS cascade, 0 новых зависимостей

---

## 2. Architecture (3 слоя)

1. **CSS Scene** (`::before`/`::after` — градиенты, glow)
2. **Inline SVG Body** (`<g class="av-body">` — голова, плечи)
3. **HTML Overlay** (микрофон, ELO badge, имя)

**Управление:** `z-index` + порядок DOM. Никакого LayerManager.

---

## 3. Tier Gate

```
useVisualBudget().scene.allowAvatar:
  ├── false (lite/balanced) → <FallbackAvatar />
  │   React.memo(), 1 render, 0 re-renders
  │   zustand subscribe() → ref.setAttribute('data-state', mood)
  │   CSS keyframes (GPU composited)
  │   NOT subscribed to --bl-audio-* vars
  │
  └── true (max/ultra) → <FullAvatar />
      Registered detector+writer in PlaybackVisualScheduler
      Half-frequency: counter % 2 === 0, <1.5ms per tick
      Reads global --bl-audio-bass, --bl-audio-mid, --bl-audio-beat CSS vars
```

---

## 4. States

| Состояние | Триггер | TTL |
|-----------|---------|-----|
| idle | Нет событий | постоянное |
| happy | feed.lastEvent.type = like/comment/react | 30s stale → idle |
| listening | ai.store.isStreaming = true | пока streaming |
| sing | audio.store.isPlaying | пока играет |
| error | feed.lastEvent.type = error | 4s → idle |
| reactive | CSS vars audio-reactive | всегда поверх |

**Priority:** listening > happy > reactive > idle

---

## 5. Performance Budget

| Компонент | Время |
|-----------|-------|
| PlaybackVisualScheduler | 4.0ms |
| BillyDock rAF | 2.0ms |
| Avatar CSS keyframes (GPU) | 0.0ms |
| Avatar state events | 0.1ms |
| Buffer | 7.5ms |
| **TOTAL** | **16.6ms @ 60fps** |

---

## 6. Key Files

| Файл | Строк | Назначение |
|------|-------|-----------|
| src/avatar/AvatarEngine.tsx | 30 | Tier gate |
| src/avatar/FallbackAvatar.tsx | 87 | CSS-animated, 0 re-renders |
| src/avatar/FullAvatar.tsx | 135 | Half-frequency detector |
| src/avatar/avatar.assets.ts | 60 | SVG presets |
| src/avatar/avatar.css | 145 | 6 states + keyframes |
| src/avatar/avatar.store.ts | 31 | Zustand store |

---

## 7. Architecture Decisions

| AD | Решение | Выбор |
|----|---------|-------|
| AD-01 | Performance Gate | Path α (modified): FallbackAvatar при allowAvatar: false |
| AD-02 | Render engine | Inline SVG + CSS cascade |
| AD-03 | Audio-reactive source | Global `--bl-audio-*` vars (reuse existing bridge) |
| AD-04 | Per-instance isolation | CSS cascade via `[data-state]` |
| AD-05 | Fallback | CSS-animated SVG (keyframes), не emoji |
| AD-06 | Scheduler integration | Half-frequency (counter % 2 === 0) |
| AD-07 | State change | Direct DOM (setAttribute), 0 React re-renders |
| AD-08 | State priority | listening > happy > reactive > idle |
| AD-09 | Silhouette | Тёмный силуэт, rgba(255,255,255,0.12) |

---

## 8. Acceptance Criteria (20 AC — all PASS ✅)

- AC-1..AC-18 — code verified (см. Avatar-Engine-Architectural-Roadmap.md)
- AC-D1..AC-D6 — documentation

---

## 9. Known Limitations (MVP)

- Audio reactivity CSS vars — global-only for MVP
- feed.lastEvent covers 4/12 actions for MVP
- BillyChat micro mode deferred to V1
- Avatar customization deferred to Phase 3

---

## 10. Frozen Zones

| Зона | Статус |
|------|--------|
| AudioEngineV2 | ✅ Not violated |
| Bridge layer | ✅ Not violated (Avatar = React component) |
| Performance policy | ✅ Strengthened (deepFreeze) |
| Marker backbone | ✅ Not violated |
| Word sync additive | ✅ Not violated |
