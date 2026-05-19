/**
 * Marker Manager for Text application
 * Central component for managing lyrics timing markers
 */

class MarkerManager {
    constructor(audioEngine, lyricsDisplay) {
        // Store references to required components
        this.audioEngine = audioEngine;
        this.lyricsDisplay = lyricsDisplay;
        
        // Initialize markers array
        this.markers = [];
        
        // Initialize update interval
        this.updateInterval = null;
        
        // Subscribers for marker changes
        this.subscribers = {
            markerAdded: [],
            markerUpdated: [],
            markerDeleted: [],
            markersReset: []
        };
        
        // Добавляем поля для секций и длительности трека
        this.sections = [];
        this.trackDuration = 0;
        
        // Initialize event listeners
        this._initEventListeners();
        
        /* FINAL2: _startUpdateLoop() call removed - dead timer, no-op every 100ms */
    }
    
    /**
     * Initialize internal event listeners
     * @private
     */
    _initEventListeners() {
        // Listen for track changes to update markers
        document.addEventListener('track-loaded', (event) => {
            if (event.detail) {
                if (event.detail.markers) {
                    this.setMarkers(event.detail.markers);
                } else {
                    this.resetMarkers();
                }
                this.trackDuration = event.detail.duration || 0; // Сохраняем длительность трека
                this.sections = this._computeSections(this.markers, this.trackDuration); // Вычисляем секции
                document.dispatchEvent(new CustomEvent('sections-updated', { detail: { sections: this.sections }})); // Диспатчим событие
            } else {
                this.resetMarkers();
                this.trackDuration = 0;
                this.sections = [];
                document.dispatchEvent(new CustomEvent('sections-updated', { detail: { sections: this.sections }}));
            }
        });
        
        // Listen for keyboard events to add markers during playback
        document.addEventListener('keydown', (event) => {
            // Skip if typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            
            // Key '1' to add M1 marker at current time for the active line
            if (event.key === '1' || event.keyCode === 49) {
                this._addMarkerForActiveLine();
            }
            
            // Key '2' to add M2 closing marker
            if (event.key === '2' || event.keyCode === 50) {
                this._addM2Marker?.();
            }
        });
    }
}

// Create global marker manager instance
const markerManager = new MarkerManager(window.audioEngine, window.lyricsDisplay);
window.markerManager = markerManager; 
