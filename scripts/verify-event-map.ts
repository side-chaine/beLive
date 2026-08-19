/**
 * Verify that LEGACY_EVENT_MAP keys don't collide with native DOM events.
 * Run as: npx tsx scripts/verify-event-map.ts
 */

import { LEGACY_EVENT_MAP } from '../src/foundation/event-bus/facade'

const RESERVED_NATIVE_EVENTS = new Set([
  'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
  'keydown', 'keyup', 'keypress',
  'load', 'unload', 'beforeunload',
  'resize', 'scroll', 'wheel',
  'focus', 'blur', 'change', 'input', 'submit',
  'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop',
  'touchstart', 'touchend', 'touchmove', 'touchcancel',
  'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
  'play', 'pause', 'ended', 'waiting', 'canplay', 'seeked', 'seeking',
  'error', 'abort', 'timeout',
  'open', 'close', 'message',
  'statechange', 'transitionend', 'animationend',
  'online', 'offline', 'visibilitychange',
  'popstate', 'hashchange', 'pagehide', 'pageshow',
  'copy', 'cut', 'paste',
])

const keys = Object.keys(LEGACY_EVENT_MAP)
let hasCollisions = false
for (const key of keys) {
  if (RESERVED_NATIVE_EVENTS.has(key)) {
    console.error(`❌ Collision: "${key}" is a native DOM event!`)
    hasCollisions = true
  }
}

if (!hasCollisions) {
  console.log(`✅ All ${keys.length} events are safe — no collisions with native DOM events.`)
  process.exit(0)
} else {
  process.exit(1)
}
