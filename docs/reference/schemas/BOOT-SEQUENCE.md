---
schema: BOOT-SEQUENCE
version: 1.0
generated: 2026-04-27
nodes:
  - id: indexHtml
    file: index.html
    layer: boot
    authority: true
    frozen: true
    observable: false
    p0: false
  - id: mainTsx
    file: src/main.tsx
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: appTsx
    file: src/App.tsx
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: featureFlag
    file: src/audio/featureFlag.ts
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: patchV1
    file: src/audio/compat/patchV1.ts
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: audioEngineJs
    file: js/audio-engine.js
    layer: legacy
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: lyricsDisplayJs
    file: js/lyrics-display.js
    layer: legacy
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: trackCatalogJs
    file: js/track-catalog.js
    layer: legacy
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: markerManagerJs
    file: js/marker-manager.js
    layer: legacy
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: monitorMixJs
    file: js/monitor-mix.js
    layer: legacy
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: pitchyModule
    file: esm.sh/pitchy@4
    layer: external
    authority: false
    frozen: true
    observable: false
    p0: false
---

# BOOT-SEQUENCE — Порядок сборки

> От index.html до рабочего продукта. Legacy globals → main.tsx → 
> App.tsx → bridges → runtime. Dual-plane boot. Timing dependencies.

## Legend

🟢 Stable | 🟡 Active | 🔴 P0 | ⚠️ Seam | ❄️ Frozen | 🔵 Observable | 📦 Boundary

## Level 1 — Bird's Eye

```
index.html (browser parses top→bottom)
  │
  ├─ <head>
  │  ├─ CSS loads (styles.css, karaoke-styles.css, etc.)
  │  ├─ Font Awesome CDN
  │  ├─ Pitchy module → window.PitchDetector
  │  ├─ Google Fonts (Roboto, Montserrat, Orbitron, etc.)
  │  ├─ Inline <script>: __BUILD__, __ADMIN__, __DEBUG__, Log, window.__DB_NAME
  │  ├─ Inline <style id="react-migration-overrides">: hide legacy UI in rehearsal mode
  │  └─ Inline <script>: FOUC prevention (read bl-theme from localStorage → set data-mode)
  │
  ├─ <body>
  │  ├─ Legacy DOM: #app-root, .app-header, #lyrics-container, #transport-controls,
  │  │   #track-catalog, #catalog-v2-overlay, #ai-chat-window, #react-root
  │  │
  │  ├─ PLANE B: Legacy JS loads (script tags, sync)
  │  │  ├─ JSZip CDN (3.10.1)
  │  │  ├─ js/audio-engine.js    → window.audioEngine (STUB: AudioContext + empty methods)
  │  │  ├─ js/lyrics-display.js  → window.lyricsDisplay (shell: DOM refs, no sync yet)
  │  │  ├─ js/track-catalog.js   → window.trackCatalog (IDB init, _loadTracksFromDB)
  │  │  ├─ js/marker-manager.js  → window.markerManager (subscribers, event listeners)
  │  │  └─ js/monitor-mix.js     → window.monitorMix (active, separate audio graph)
  │  │
  │  ├─ Shim: ModalBlockEditorShim → window.ModalBlockEditor
  │  │
  │  └─ <script type="module" src="/src/main.tsx">
  │     ├─ PLANE A: Boot coordination
  │     │  ├─ DOMContentLoaded (async)
  │     │  │  ├─ window.__BELIVE_BOOTED__ guard
  │     │  │  ├─ window.app stub (holds mode, audioEngine, lyricsDisplay refs)
  │     │  │  ├─ registerLiveModeStub()
  │     │  │  ├─ registerWaveformEditorStub()
  │     │  │  ├─ initBlocksBridge()
  │     │  │  ├─ installLiveGuard()
  │     │  │  ├─ initLoopBridge()
  │     │  │  ├─ initAudioReactiveBridge()
  │     │  │  ├─ initBlockEditorBridge()
  │     │  │  ├─ window.markerService = markerService
  │     │  │  ├─ patchLyricsDisplaySlimMethods()
  │     │  │  ├─ window.markerManager patches (15+ methods: _getColorForBlockType, setMarkers, etc.)
  │     │  │  ├─ window.markerManager._addM2Marker() (M2 closing marker)
  │     │  │  ├─ import() → window.showAppNotification, window.parsingService, window.idbService
  │     │  │  ├─ window.rtfService = { parseRtf }
  │     │  │  ├─ window.openCatalog → React catalog (useUIStore)
  │     │  │  ├─ AI Hub: GatewayProvider + AIChatUI + ModelDropdownUI
  │     │  │  └─ aiHub.on('modelChanged') → update Operator button
  │     │  │
  │     └─ React mount (OUTSIDE DOMContentLoaded — immediate)
  │        └─ createRoot(#react-root) → ThemeProvider → App
  │
  └─ App.tsx mounts (React useEffect)
     ├─ tryActivateV2() → patchV1WithV2(window.audioEngine) → AudioEngineV2
     ├─ initTrackEventListeners()
     ├─ initAudioBridge()         ← audio.store ↔ DOM controls
     ├─ initLyricsBridge()        ← lyrics.store ↔ lyricsDisplay
     ├─ initMarkersBridge()       ← markers.store ↔ markerManager
     ├─ initModeBridge()          ← mode.store ↔ mode buttons
     ├─ initTrackBridge()         ← track load/unload lifecycle
     ├─ initCoverThemeBridge()    ← cover art sync
     ├─ initSyncBridge()          ← sync editor state
     ├─ initTimeSync()            ← time display bridge
     ├─ initTriggerBridge()       ← trigger system
     ├─ initStemReactiveBridge()  ← stem state reactivity
     ├─ initTextStyleBridge()     ← text style persistence
     ├─ initPerformanceBridge()   ← performance monitoring
     ├─ initTakesBridge()         ← takes system
     ├─ initExerciseBridge()      ← exercise orchestration
     └─ initMonitorBridge()       ← MonitorMix lifecycle binding
```

## Level 2 — Wire Table

### Секция A: Boot Timeline (порядок инициализации)

| Step | Action | File | Creates/Inits | Depends On | Status |
|------|--------|------|---------------|------------|--------|
| 1 | Browser parses `<head>` | index.html | CSS, fonts, Pitchy module | — | ❄️ |
| 2 | FOUC prevention | index.html inline | `document.documentElement.data-mode` | localStorage `bl-theme` | ❄️ |
| 3 | JSZip CDN loads | index.html | `window.JSZip` | — | ❄️ |
| 4 | audio-engine.js executes | js/audio-engine.js | `window.audioEngine` (stub, AudioContext) | — | ❄️ |
| 5 | lyrics-display.js executes | js/lyrics-display.js | `window.lyricsDisplay` (shell) | DOM `#lyrics-display` | ❄️ |
| 6 | track-catalog.js executes | js/track-catalog.js | `window.trackCatalog`, IDB open | DOM `#catalog-tracks` | ❄️ |
| 7 | marker-manager.js executes | js/marker-manager.js | `window.markerManager`, event listeners | `window.audioEngine`, `window.lyricsDisplay` | ❄️ |
| 8 | monitor-mix.js executes | js/monitor-mix.js | `window.monitorMix` (active) | `window.audioEngine` | 🟡 |
| 9 | ModalBlockEditorShim | index.html inline | `window.ModalBlockEditor` | — | ❄️ |
| 10 | main.tsx module loads | src/main.tsx | React imports, bridge functions | Vite module system | ❄️ |
| 11 | React mounts | src/main.tsx | `createRoot(#react-root)` → ThemeProvider → App | DOM `#react-root` | ❄️ |
| 12 | DOMContentLoaded fires | src/main.tsx | window.app stub, all bridges, marker patches | DOM ready | ❄️ |
| 13 | App.tsx useEffect runs | src/App.tsx | tryActivateV2(), 16 bridges | React mount complete | ❄️ |
| 14 | V2 activation | featureFlag.ts → patchV1.ts | AudioEngineV2 instance, all v1 methods patched | `window.audioEngine` exists | ❄️ |
| 15 | System operational | — | All bridges connected, stores synced | Steps 1-14 complete | 🟢 |

### Секция B: Global Availability (когда каждый global готов)

| Global | Created By | Available After | Patched By | Status |
|--------|-----------|----------------|-----------|--------|
| `window.audioEngine` | js/audio-engine.js | Step 4 (sync script) | patchV1WithV2 (Step 14) | ❄️ |
| `window.lyricsDisplay` | js/lyrics-display.js | Step 5 (sync script) | patchLyricsDisplaySlimMethods (Step 12) | ❄️ |
| `window.trackCatalog` | js/track-catalog.js | Step 6 (sync script) | — (reads IDB async) | ❄️ |
| `window.markerManager` | js/marker-manager.js | Step 7 (sync script) | main.tsx DOMContentLoaded (15+ methods) | ❄️ |
| `window.monitorMix` | js/monitor-mix.js | Step 8 (sync script) | initMonitorBridge (Step 13) | 🟡 |
| `window.PitchDetector` | esm.sh/pitchy@4 | Step 1 (module in head) | — | ❄️ |
| `window.JSZip` | CDN | Step 3 (sync script) | — | ❄️ |
| `window.ModalBlockEditor` | index.html shim | Step 9 (inline script) | — | ❄️ |
| `window.app` | main.tsx DOMContentLoaded | Step 12 | — | ❄️ |
| `window.markerService` | main.tsx DOMContentLoaded | Step 12 | — | ❄️ |
| `window.showAppNotification` | main.tsx dynamic import | Step 12 (async) | — | ❄️ |
| `window.parsingService` | main.tsx dynamic import | Step 12 (async) | — | ❄️ |
| `window.idbService` | main.tsx dynamic import | Step 12 (async) | — | ❄️ |
| `window.rtfService` | main.tsx DOMContentLoaded | Step 12 | — | ❄️ |
| `window.openCatalog` | main.tsx DOMContentLoaded | Step 12 | Overrides legacy → React catalog | ❄️ |
| `window.__BELIVE_BOOTED__` | main.tsx DOMContentLoaded | Step 12 | Guard against re-init | ❄️ |

### Секция C: Bridge Init Order (когда каждый bridge стартует)

| # | Bridge | Init Location | Depends On | Starts After | Status |
|---|--------|--------------|------------|-------------|--------|
| 1 | blocks.bridge | main.tsx DOMContentLoaded | — | Step 12 | ❄️ |
| 2 | live-guard | main.tsx DOMContentLoaded | — | Step 12 | ❄️ |
| 3 | loop.bridge | main.tsx DOMContentLoaded | — | Step 12 | ❄️ |
| 4 | audio-reactive.bridge | main.tsx DOMContentLoaded | `window.audioEngine` | Step 12 | ❄️ |
| 5 | blockEditor.bridge | main.tsx DOMContentLoaded | — | Step 12 | ❄️ |
| 6 | audio.bridge | App.tsx useEffect | AudioEngineV2 active | Step 13 | ❄️ |
| 7 | lyrics.bridge | App.tsx useEffect | `window.lyricsDisplay` patched | Step 13 | ❄️ |
| 8 | markers.bridge | App.tsx useEffect | `window.markerManager` patched | Step 13 | ❄️ |
| 9 | mode.bridge | App.tsx useEffect | `window.app.currentMode` | Step 13 | ❄️ |
| 10 | track.bridge | App.tsx useEffect | IDB service available | Step 13 | ❄️ |
| 11 | cover-theme.bridge | App.tsx useEffect | track.bridge loaded | Step 13 | ❄️ |
| 12 | sync.bridge | App.tsx useEffect | sync.store init | Step 13 | ❄️ |
| 13 | time-sync | App.tsx useEffect | audio.bridge active | Step 13 | ❄️ |
| 14 | trigger.bridge | App.tsx useEffect | — | Step 13 | ❄️ |
| 15 | stem-reactive.bridge | App.tsx useEffect | audio.bridge active | Step 13 | ❄️ |
| 16 | textStyle.bridge | App.tsx useEffect | — | Step 13 | ❄️ |
| 17 | performance.bridge | App.tsx useEffect | — | Step 13 | ❄️ |
| 18 | takes.bridge | App.tsx useEffect | — | Step 13 | ❄️ |
| 19 | exercise.bridge | App.tsx useEffect | audio.bridge, takes.bridge | Step 13 | ❄️ |
| 20 | monitor.bridge | App.tsx useEffect | `window.monitorMix` exists | Step 13 | 🟡 |

### Секция D: Timing Dependencies (delays, retries, polling)

| Component | Delay | Reason | Fallback | Status |
|-----------|-------|--------|----------|--------|
| Pitchy module load | Async (module) | ESM import from CDN | Pitch detection disabled if fails | ❄️ |
| IDB open (track-catalog) | Async (indexedDB.open) | Database initialization | Fallback: delete + retry → Recovery DB | ❄️ |
| React mount | Immediate (outside DOMContentLoaded) | Faster render start | Warn if `#react-root` not found | ❄️ |
| DOMContentLoaded bridges | Wait for DOM ready | Need DOM elements for patching | `window.__BELIVE_BOOTED__` guard prevents double-init | ❄️ |
| App.tsx useEffect | After React mount | Needs component lifecycle | Cleanup on unmount | ❄️ |
| tryActivateV2() | First useEffect run | Needs `window.audioEngine` to exist | Returns false if not found, retries on next mount | ❄️ |
| Dynamic imports (notification, parsing, idb) | Async (import()) | Code splitting | Services unavailable until loaded | ❄️ |
| AI Chat UI init | After DOMContentLoaded | Needs DOM elements | AI Hub works without UI | ❄️ |
| Live mode auto-activate | 1000ms delay (index.html) | Wait for components to init | sessionStorage flag `activateLiveMode` | ❄️ |
| MonitorMix enable | On user action (not boot) | Requires AudioContext resume | Disabled by default | 🟡 |

## Level 3 — Deep Dive

### 1. index.html — Boot Entry Point

**Authority:** True — defines script load order, CSS, DOM structure

**Critical Decisions:**
- Script load order is SYNC (not async/defer): JSZip → audio-engine.js → lyrics-display.js → track-catalog.js → marker-manager.js → monitor-mix.js
- React module (`main.tsx`) loads LAST as `<script type="module">`
- FOUC prevention inline script runs BEFORE first paint (reads `bl-theme` from localStorage)
- Legacy UI hidden via `<style id="react-migration-overrides">` in rehearsal mode

**Boot Timing:**
```
<head> parsing: ~50-100ms (CSS, fonts, inline scripts)
<body> legacy scripts: ~200-400ms (JS execution + IDB open)
main.tsx module: ~100-200ms (Vite dev) / ~50ms (prod)
DOMContentLoaded: ~300-600ms total
React mount: ~50-100ms
App.tsx useEffect: ~10-20ms
Total boot to operational: ~500-1000ms (dev), ~300-600ms (prod)
```

### 2. PLANE B — Legacy Globals (js/*.js)

**Purpose:** Provide identity contracts for bridges. These are NOT migration artifacts — they ARE the architecture.

**Boot Sequence (sync execution):**

```javascript
// Step 4: js/audio-engine.js
window.audioEngine = new AudioEngine();
// Creates: AudioContext, duration=0, stub methods (play/pause/seek/loadTrack all no-op)
// Space bar listener attached here (interrupt practice + play/pause toggle)

// Step 5: js/lyrics-display.js
window.lyricsDisplay = new LyricsDisplay();
// Creates: DOM refs (#lyrics-display, #lyrics-container), empty lyrics array, block mode state

// Step 6: js/track-catalog.js
window.trackCatalog = new TrackCatalog();
// Creates: IDB connection (async), tracks array, currentTrackIndex=-1
// _loadTracksFromDB() fires on IDB success

// Step 7: js/marker-manager.js
window.markerManager = new MarkerManager(window.audioEngine, window.lyricsDisplay);
// Creates: markers array, subscribers object, event listeners (track-loaded, keydown '1'/'2')
// Does NOT start update loop (removed — dead timer)

// Step 8: js/monitor-mix.js
window.monitorMix = new MonitorMix();
// Creates: SEPARATE audio graph (not through AudioEngineV2)
// Lifecycle: disabled by default, enabled via initMonitorBridge() on user action
```

### 3. PLANE A — main.tsx Boot Coordination

**Purpose:** Patch legacy globals, init pre-React bridges, mount React shell.

**DOMContentLoaded Flow (async, runs after DOM ready):**

```typescript
// Guard: prevent double-init
if (window.__BELIVE_BOOTED__) return;
window.__BELIVE_BOOTED__ = true;

// 1. window.app stub (replaces legacy app.js)
window.app = {
  currentMode: null,
  previousMode: null,
  initComplete: true,
  lyricsEnabled: true,
  lyricsDisplay: window.lyricsDisplay,
  audioEngine: window.audioEngine,
  // ... background managers, notification
};

// 2. Stub registration
registerLiveModeStub();
registerWaveformEditorStub();

// 3. Pre-React bridges (no React dependencies)
initBlocksBridge();
installLiveGuard();
initLoopBridge();
initAudioReactiveBridge();
initBlockEditorBridge();

// 4. Service globals
window.markerService = markerService;
patchLyricsDisplaySlimMethods(); // F60: adds methods to existing lyricsDisplay object

// 5. markerManager patches (15+ methods added to EXISTING object)
const mm = window.markerManager;
mm._getColorForBlockType = ...
mm._buildBlocksFromMarkers = ...
mm._computeSections = ...
mm._getBlockTypeForLine = ...
mm.resetMarkers = ...
mm.updateMarkerColors = ...
mm.setMarkers = ...
mm.addMarker = ...
mm.updateMarker = ...
mm.deleteMarker = ...
mm.getMarkers = ...
mm.getMarkerForLine = ...
mm.subscribe = ...
mm._notifySubscribers = ...
mm.saveMarkersToTrack = ...
mm.importMarkers = ...
mm._activateNextLine = ...
mm._addMarkerForActiveLine = ...
mm._addM2Marker = ... // M2 closing marker placement

// 6. Dynamic imports (async, fire-and-forget)
import('./utils/notification').then(n => { window.showAppNotification = n.showAppNotification; });
import('./services/parsing.service').then(ps => { window.parsingService = ps; });
import('./services/idb.service').then(idb => { window.idbService = idb; });

// 7. RTF service
window.rtfService = { parseRtf: async (rtfText) => { ... } };

// 8. Catalog override
window.openCatalog = () => { useUIStore.getState().setCatalogOpen(true); };

// 9. AI Hub init
aiHub.register(new GatewayProvider(GATEWAY_URL));
new AIChatUI();
new ModelDropdownUI();
```

**React Mount (OUTSIDE DOMContentLoaded — immediate):**

```typescript
// Runs BEFORE DOMContentLoaded (module executes immediately)
const reactRoot = document.getElementById('react-root');
if (reactRoot) {
  createRoot(reactRoot).render(
    React.createElement(React.Fragment, null,
      React.createElement(ThemeProvider),
      React.createElement(App)
    )
  );
}
```

### 4. App.tsx — React Runtime Activation

**Purpose:** Activate V2 engine, init all React bridges, render mode surfaces.

**useEffect (runs once on mount):**

```typescript
useEffect(() => {
  // STEP 1: Activate V2 (MUST be first — all other bridges depend on it)
  tryActivateV2(); // → patchV1WithV2(window.audioEngine) → AudioEngineV2

  // STEP 2: Track event listeners
  initTrackEventListeners();

  // STEP 3: Init 16 bridges (order matters!)
  const cleanupAudio = initAudioBridge();         // audio.store ↔ DOM controls
  const cleanupLyrics = initLyricsBridge();       // lyrics.store ↔ lyricsDisplay
  const cleanupMarkers = initMarkersBridge();     // markers.store ↔ markerManager
  const cleanupMode = initModeBridge();           // mode.store ↔ mode buttons
  const cleanupTrack = initTrackBridge();         // track load/unload
  const cleanupCoverTheme = initCoverThemeBridge(); // cover art
  const cleanupSync = initSyncBridge();           // sync editor
  const cleanupTimeSync = initTimeSync();         // time display
  const cleanupTrigger = initTriggerBridge();     // triggers
  const cleanupStemReactive = initStemReactiveBridge(); // stem reactivity
  const cleanupTextStyle = initTextStyleBridge(); // text styles
  const cleanupPerformance = initPerformanceBridge(); // perf monitoring
  const cleanupTakes = initTakesBridge();         // takes system
  const cleanupExercise = initExerciseBridge();   // exercises
  const cleanupMonitor = initMonitorBridge();     // MonitorMix lifecycle

  // Cleanup on unmount
  return () => { /* all cleanup functions */ };
}, []);
```

**Render (mode-dependent):**
```tsx
{mode === 'rehearsal' && !syncOpen && (<> <WagonTrain /> <RehearsalLyrics /> </>)}
{syncOpen && <SyncLyrics />}
{(mode === 'karaoke' || mode === 'concert') && <KaraokeLyricsBoard />}
<CameraPreview />
<LiveSubtitle />
<LiveControls />
{syncOpen ? <SyncEditorPanel /> : (<> <ControlDeck /> <PianoOverlay /> </>)}
```

### 5. tryActivateV2() → patchV1WithV2() — V1→V2 Migration

**File:** `src/audio/featureFlag.ts` → `src/audio/compat/patchV1.ts`

**Mechanism:**
```typescript
// featureFlag.ts
export function tryActivateV2(): boolean {
  const ae = window.audioEngine;
  if (!ae) return false; // Not ready yet
  
  if (_v2) return true; // Already active
  
  _v2 = patchV1WithV2(ae); // Patch v1 object in-place
  return true;
}

// patchV1.ts
export function patchV1WithV2(v1: any): AudioEngineV2 {
  // 1. Inject v1 AudioContext → v2 singleton
  if (v1.audioContext) setAudioContext(v1.audioContext);
  
  // 2. Create v2 engine
  const v2 = new AudioEngineV2();
  
  // 3. Patch ALL v1 methods → v2 (40+ methods)
  v1.play = () => v2.play();
  v1.pause = () => v2.pause();
  v1.loadTrack = (...) => v2.loadTrack(...);
  // ... 37 more methods
  
  // 4. Patch properties via Object.defineProperties
  Object.defineProperties(v1, {
    duration: { get: () => v2.duration },
    isPlaying: { get: () => v2.isPlaying, set: (val) => { v2.isPlaying = val; } },
    instrumentalGain: { get: () => v2.stems.get('instrumental')?.gainNode },
    // ... 15 more properties
  });
  
  // 5. Identity preserved: window.audioEngine === v1 (same object, new methods)
  return v2;
}
```

**Critical Invariant:** `window.audioEngine` identity is NEVER swapped. V2 authority sits BEHIND the v1 object. Cached refs (`app.audioEngine`, `BLC.audioEngine`) auto-see V2 methods.

### 6. Dual-Plane Boot — Why This Architecture?

**Plane B (Legacy) loads FIRST because:**
- Bridges expect `window.audioEngine`, `window.lyricsDisplay`, `window.markerManager` to exist
- IDB initialization must start early (async, takes 100-300ms)
- Event listeners (keydown '1'/'2', track-loaded) must be registered before React mounts

**Plane A (React) loads SECOND because:**
- React needs DOM to exist (`#react-root`)
- Bridges need legacy globals to patch
- V2 activation needs `window.audioEngine` stub to exist

**This is NOT a bug — it's intentional dual-plane boot.**

## 🔵 Observability Points

| # | Point | File | Priority | What It Tells Us |
|---|-------|------|----------|-----------------|
| 1 | `window.__BELIVE_BOOTED__` | main.tsx | P0 | Guard against double-init — if missing, system may init twice |
| 2 | `window.audioEngine` existence | featureFlag.ts | P0 | If undefined at tryActivateV2(), V2 never activates — silent failure |
| 3 | V2 activation log | patchV1.ts | P1 | "✅ AudioEngine v1 fully patched → v2" confirms successful patch |
| 4 | Bridge init errors | App.tsx useEffect | P1 | Any bridge failing to init → silent gap in functionality |
| 5 | IDB open timing | track-catalog.js | P1 | Slow IDB (>500ms) → catalog loads late, tracks unavailable |
| 6 | React mount timing | main.tsx | P2 | If `#react-root` missing → React shell not mounted, app broken |
| 7 | DOMContentLoaded delay | main.tsx | P2 | Long delay (>1s) → DOM blocking, slow boot |
| 8 | MonitorMix enable | monitor.bridge | P2 | If fails → separate output device routing broken (BT speakers) |

## 🔗 Cross-References

- **SYSTEM-TOPOLOGY:** Plane A/Plane B split, dual-plane boot rationale
- **BRIDGE-EVENT-MATRIX:** All 20 bridges and their event subscriptions
- **AUDIO-PIPELINE:** AudioEngineV2, patchV1, MonitorMix lifecycle
- **ARCH-BASE:** Identity contracts, bridge architecture principles
- **n-stem-architecture:** Progressive loading, V2 engine initialization
- **marker-system-spec:** M2 marker placement via `_addM2Marker()`

## ⚠️ Architecture Seams

### Seam 1: React Mount vs DOMContentLoaded Timing

**Risk:** React mounts BEFORE DOMContentLoaded. If App.tsx useEffect runs before DOMContentLoaded completes, bridges may find unpatched legacy globals.

**Reality:** React mount is async (createRoot), useEffect runs after paint. DOMContentLoaded fires before paint. **No conflict in practice**, but this is a timing dependency, not a guarantee.

**Mitigation:** `tryActivateV2()` checks `window.audioEngine` existence — returns false if not ready.

### Seam 2: MonitorMix Separate Audio Graph

**Risk:** MonitorMix creates its own AudioContext and routing, NOT through AudioEngineV2. This can cause:
- Duplicate AudioContext (if V2 creates new one)
- Routing conflicts (MonitorMix reads from `audioEngine.instrumentalGain` — may be null if V2 not active)

**Mitigation:** `_bindTrackLifecycle()` in monitor.bridge ensures MonitorMix only enables after track loaded.

### Seam 3: Dynamic Imports Fire-and-Forget

**Risk:** `import('./utils/notification')` etc. are async and NOT awaited. If code uses `window.showAppNotification` before import resolves → undefined.

**Reality:** These are used only in user interactions (notification calls), not boot-critical paths. **Low risk**.

## Architecture Summary

**Boot Phases:** 3
1. **Plane B (Legacy):** ~200-400ms — 5 globals created, IDB init, event listeners
2. **Plane A (Coordination):** ~100-200ms — DOMContentLoaded patches, React mounts
3. **Runtime Activation:** ~10-20ms — V2 activation, 16 bridges init, system operational

**Total Boot Time:** ~300-600ms (prod), ~500-1000ms (dev)

**Identity Contracts Preserved:**
- `window.audioEngine` — NEVER swapped, patched in-place
- `window.lyricsDisplay` — NEVER swapped, methods added
- `window.markerManager` — NEVER swapped, 15+ methods patched
- `window.trackCatalog` — NEVER swapped, IDB lifecycle preserved
- `window.monitorMix` — NEVER swapped, separate audio graph preserved

**Critical Invariant:** Dual-plane boot is INTENTIONAL. Plane B (legacy) MUST load before Plane A (React). This is not technical debt — it's the hybrid architecture.
