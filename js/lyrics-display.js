/**
 * Lyrics Display for Text application
 * Handles displaying and synchronizing lyrics with audio
 */

class LyricsDisplay {
    constructor() {
        this.lyricsContainer = document.getElementById('lyrics-display');
        this.containerElement = document.getElementById('lyrics-container');
        this.currentLine = 0;
        this.lyrics = [];
        this.currentLyricElement = null;
        this.fullText = '';
        this.duration = 0;
        this.autoScrollEnabled = true;
        this.lastScrollTime = 0;
        this._usingLinkinParkMap = false;
        this._lastEditModeState = false;  // Track edit mode state changes
        
        // Karaoke mode elements
        this.karaokeLineElements = [];
        this.activeKaraokeEl = null;
        this.nextKaraokeEl = null;
        
        // Add style properties
        this.currentStyle = null; // Current applied style
        this.styleClasses = {}; // Store applied style classes
        this.appliedStyleClasses = []; // List of currently applied style classes
        this.currentlyFocusedBlockId = null; // ADDED: To track the currently focused block in rehearsal mode
        
        // Block mode properties
        this.textBlocks = []; // Stores defined blocks: [{ id: string, name: string, lineIndices: number[] }]
        this.currentBlockCreation = []; // Stores line indices for the block currently being created
        this.isInBlockMode = false; // True if block creation UI is active
        
        // Initialize event listeners for manual scrolling
        // Initialize touch handlers for mobile
        // Flag to track if we're using the marker manager
        this.usingMarkerManager = false;
        
        // Configuration options
        this.options = {
            autoScroll: true, // Auto-scroll to keep active line in view
            showControls: true, // Show lyrics control buttons
            highlightActive: true, // Highlight active line
            scrollBehavior: 'smooth' // Smooth scrolling
        };
        
        this.isRehearsalModeActive = false; // Flag for rehearsal mode state
        this.currentActiveBlock = null; // Store the currently active block in rehearsal mode
    }
}

// Create global lyrics display instance
const lyricsDisplay = new LyricsDisplay();
window.lyricsDisplay = lyricsDisplay; 