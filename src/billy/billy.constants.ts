// ═══ Billy v2 — Architectural Constants ═══
// Все magic numbers в одном месте.
// Инварианты: INV-BILLY-T1, INV-BILLY-COORD, INV-BILLY-ANCHOR,
//             INV-BILLY-BRIDGE, INV-BILLY-DOMAINS,
//             INV-BILLY-FRAMERATE, INV-BILLY-NO-CGS

// ── SVG Dimensions ──
export const BILLY_WIDTH = 64;
export const BILLY_HEIGHT = 91;
export const BILLY_HALF_WIDTH = BILLY_WIDTH / 2;

// ── Visual Foot Anchor ──
// ViewBox: 0 0 140 200, Render: 91px (scale = 91/200 = 0.455)
// Обувь в viewBox: ellipse cy=182, ry=6 → низ = y=188
// Визуальный низ ног: 188 × 0.455 = 85.5 ≈ 85px
// BILLY_HEIGHT (91) включает 6px пустого пространства под ногами
export const BILLY_VISUAL_FOOT_Y = 85;

// ── Walk Control ──
// Target offset для control mode: target всегда впереди Billy
// Скорость = offset × lerpFactor × fps ≈ 0.02 × 0.25 × 30 ≈ 0.27 norm/sec
// ≈ 3.7 сек на пересечение экрана — комфортная ходьба
export const WALK_TARGET_OFFSET = 0.02;

// ── Coordinate System ──
// Billy position: нормализованная 0..1 по viewport
// posX: 0 = левый край, 1 = правый край
// posY: 0 = верх viewport, 1 = низ viewport
// y = футы (INV-BILLY-ANCHOR)
export const POS_MIN = 0;
export const POS_MAX = 1;

// ── Lerp Responsiveness ──
// Frame-rate independent: lerpAdj = 1 - Math.pow(1 - base, dt * 60)
// (INV-BILLY-FRAMERATE)
export const RESPONSIVENESS = {
  PLAYER:       0.25,  // Control Mode — отзывчивый (~120ms lag)
  CHASE:        0.12,  // Важная задача — подбежать к строке
  NPC_GROOVE:   0.08,  // Танец на месте
  NPC_PATROL:   0.05,  // Ленивый патруль
  IDLE_DRIFT:   0.02,  // Микро-дрейф в idle
} as const;

// Deadzone: если |target - current| < threshold → snap
export const POSITION_DEADZONE = 0.001;

// ── BPM-Dependent Speed ──
// Soft-cap formula:
//   factor = bpm / BPM_BASE
//   speedFactor = factor < 1.5 ? factor : 1.5 + (factor - 1.5) * BPM_SOFT_CAP_DECAY
//   speed = clamp(baseSpeed * speedFactor, SPEED_MIN, SPEED_MAX)
export const BPM_BASE = 120;
export const BPM_SOFT_CAP_THRESHOLD = 1.5;
export const BPM_SOFT_CAP_DECAY = 0.3;
export const SPEED_BASE = 2;     // нормализованных единиц/сек
export const SPEED_MIN = 0.3;    // медленный дрейф
export const SPEED_MAX = 5;      // максимальная скорость

// ── Zone Z-Index ──
// Меняется только при смене зоны (редко), не каждый кадр
export const ZONE_Z_INDEX = {
  corner:  999996,   // Поверх всего (как Header)
  ground:  999994,   // ПОД ControlDeck (z:999995), НАД RehearsalLyrics (z:5-19)
  plaque:  110,      // Над RehearsalLyrics (z:5)
  rope:    90,       // Над WagonTrain (z:10) и KaraokeLyricsBoard (z:50)
  retreat: 999996,   // Overlay retreat = corner
} as const;

// ── Corner Position (normalized 0..1) ──
// Правый нижний угол — "дом" Билли
export const CORNER_POS = {
  x: 0.92,  // правый край с отступом
  y: 0.92,  // над ControlDeck
} as const;

// ── Safe Margins ──
export const BILLY_MARGIN_X = BILLY_HALF_WIDTH; // 32px — не вылезать за viewport

// ── Transient Durations (ms) ──
export const JUMP_DURATION = 750;
export const RETREAT_DURATION = 400;
export const SOMERSAULT_DURATION = 600;
export const WAVE_DURATION = 500;

// ── FSM Mode Names ──
export type BillyMode =
  | 'patrol'      // стоит/дрейфует на GROUND
  | 'groove'      // танцует (isPlaying)
  | 'think'       // в CORNER (isAiStreaming)
  | 'sleep'       // в CORNER (!hasTrack)
  | 'jump'        // transient: клик / смена трека
  | 'retreat';    // transient: overlay open → CORNER

// ── Zone Names ──
export type BillyZone = 'corner' | 'ground' | 'plaque' | 'rope';

// ── Animation Domains (INV-BILLY-DOMAINS) ──
// Tier ⊥ FSM ⊥ Audio — мультипликативная композиция
// armAmplitude = behaviorBase[mode] * tierMultiplier[tier] * audioEnergy
export const BEHAVIOR_BASE: Record<string, number> = {
  idle:         0,   // arms static
  groove:       8,   // лёгкое покачивание
  dance:        16,  // полный размах
  'dance.heavy': 24, // супер-энергичный
};

export const TIER_MULTIPLIER: Record<string, number> = {
  lite:     0,    // no arm animation
  balanced: 0.7,  // 70% amplitude
  max:      1.0,  // full
  ultra:    1.0,  // full + audio-reactive overlay
};

// ── PlaybackVisualScheduler ──
// Billy как participant (INV-BILLY-NO-CGS)
export const BILLY_SCHEDULER_ID = 'billy-locomotion';

// ── Zone Cache TTL ──
// Зоны обновляются на resize/mount/track-change
// В hot-path — только кэш (INV-BILLY-COORD)
export const ZONE_CACHE_REFRESH_EVENTS = [
  'resize',
  'before-track-change',
  'track-loaded',
  'mode-changed',
] as const;

// ── Performance: Locomotion FPS по Tier ──
export const LOCOMOTION_FPS: Record<string, number> = {
  lite:     20,
  balanced: 30,
  max:      30,
  ultra:    60,
};

// ── Future: Reserved (не используются в W2) ──
// REST micro-state: после 20s PATROL → сидит 3s
export const PATROL_REST_THRESHOLD = 20_000; // ms
export const REST_DURATION = 3_000;           // ms

// Click-to-summon (W3+): right-click → бежит
// Live mode: Billy HIDDEN (opacity 0, animations none)
export const LIVE_MODE_BILLY_HIDDEN = true;

// ── Eye Tracking ──
export const PUPIL_OFFSET_MAX_X = 6;     // ±6px horizontal
export const PUPIL_OFFSET_MAX_Y = 3;     // ±3px vertical
export const PUPIL_RADIUS_BASE = 6.5;
export const PUPIL_RADIUS_MIN = 3;
export const PUPIL_RADIUS_MAX = 10;
export const PUPIL_FOCUS_DELTA = -1;     // Control Mode → сужение
export const PUPIL_CELEBRATE_DELTA = 1.5;// Celebration → расширение (W7)
export const PUPIL_BEAT_DELTA = 0.5;     // Audio beat → расширение (Max+)
