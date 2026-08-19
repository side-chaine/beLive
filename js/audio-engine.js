/**
 * AudioEngine v1 — STUB.
 * All methods patched by React v2 (src/audio/compat/patchV1.ts).
 * This stub provides: boot object + AudioContext.
 */
class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.duration = 0;
        this.instrumentalAudio = null;
        this.vocalsAudio = null;
        this.hybridEngine = null;
        this.stereoMerger = null;
        this._onTrackLoadedCallbacks = [];
        this._onPositionUpdateCallbacks = [];
        this._onBothEndedCallbacks = [];
        // _setupSpaceBar() migrated to useKeyboardShortcuts.ts
    }

    // Stubs — overwritten by patchV1WithV2() from React
    play() {} pause() {} stop() {}
    getCurrentTime() { return 0; }
    setCurrentTime() {} seekTo() {}
    loadTrack() { return Promise.resolve(); }
    setInstrumentalVolume() {} setVocalsVolume() {} setMicrophoneVolume() {}
    setLoop() {} clearLoop() {}
    onTrackLoaded() {} onPositionUpdate() {} onBothEnded() {}
    removeEventListener() {}
    captureStream() { return null; }
    reset() {} cleanup() {}
}

window.audioEngine = new AudioEngine();
