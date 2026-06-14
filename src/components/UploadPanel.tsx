import { useState, useRef, useCallback, useEffect } from 'react';
import { resetUploadSession, handleFileSelect, clearFile as clearUploadFile, saveTrack, cancelUpload } from '../services/upload.actions';
import { extractCleanLyrics, detectedBlocksToPersistedBlocks } from '../services/auto-lyrics.service'; // TC-002: clean lyrics extraction // TC-ZIP-03: block converter

/* ═══════════════════════════════════════════
   Upload Panel — Sprint 36
   3 file cells: Instrumental, Vocals, Lyrics
   Delegates all logic to upload.actions
   ═══════════════════════════════════════════ */

interface UploadFiles {
  instrumental: File | null;
  vocal: File | null;
  lyrics: File | null;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  autoOpenLyrics?: boolean; // W9-UX: Auto-open lyrics paste modal
  pendingTrackId?: number | null; // W9-UX-002: Track ID for direct lyrics update
  pendingTrackTitle?: string | null; // TC-GENIUS-001: Track title for Genius link
}

const CELLS = [
  { key: 'instrumental' as const, label: 'Instrumental', icon: '🎵', accept: 'audio/*', required: true },
  { key: 'vocal' as const,        label: 'Vocals',       icon: '🎤', accept: 'audio/*', required: false },
  { key: 'lyrics' as const,       label: 'Lyrics',       icon: '📝', accept: '.txt,.text,.lrc,.md,.rtf,.doc,.docx,.srt,.sub,.vtt,.ass,.ssa,.xml,.json,.csv,text/plain,text/rtf,application/rtf,application/msword,text/*', required: false },
] as const;

export function UploadPanel({ onClose, onSaved, autoOpenLyrics, pendingTrackId, pendingTrackTitle }: Props) {
  const [files, setFiles] = useState<UploadFiles>({
    instrumental: null,
    vocal: null,
    lyrics: null,
  });
  const [saving, setSaving] = useState(false);
  const [showLyricsPaste, setShowLyricsPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [lyricsFontSize, setLyricsFontSize] = useState(14);

  const instRef = useRef<HTMLInputElement>(null);
  const vocRef = useRef<HTMLInputElement>(null);
  const lyrRef = useRef<HTMLInputElement>(null);
  const refs = { instrumental: instRef, vocal: vocRef, lyrics: lyrRef };

  // Reset legacy uploadSession on mount
  useEffect(() => {
    resetUploadSession();
  }, []);

  // W9-UX: Auto-open lyrics paste modal when triggered from ZIP upload
  useEffect(() => {
    if (autoOpenLyrics) {
      setShowLyricsPaste(true);
    }
  }, [autoOpenLyrics]);

  const handleFile = useCallback((type: keyof UploadFiles, file: File | null) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [type]: file }));
    const fakeCell = document.createElement('div');
    fakeCell.classList.add('upload-cell');
    fakeCell.dataset.type = type;
    fakeCell.innerHTML = '<div class="dropzone-content"></div>';
    handleFileSelect(type, file, fakeCell);
  }, []);

  const clearFile = useCallback((type: keyof UploadFiles) => {
    setFiles(prev => ({ ...prev, [type]: null }));
    clearUploadFile(type);
    const ref = refs[type];
    if (ref.current) ref.current.value = '';
  }, []);

  const handleSave = useCallback(async () => {
    if (!files.instrumental || saving) return;
    setSaving(true);
    try {
      await saveTrack();
      onSaved();
    } catch (err) {
      console.error('[UploadPanel] Save error:', err);
      setSaving(false);
    }
  }, [files.instrumental, saving, onSaved]);

  const handleCancel = useCallback(() => {
    cancelUpload();
    onClose();
  }, [onClose]);

  const handlePastedLyrics = (text: string) => {
    // Create a virtual File from pasted text
    const blob = new Blob([text], { type: 'text/plain' });
    const virtualFile = new File([blob], 'pasted-lyrics.txt', { type: 'text/plain' });
    handleFile('lyrics', virtualFile);
  };

  // Escape key listener for modal
  useEffect(() => {
    if (!showLyricsPaste) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLyricsPaste(false);
        setPastedText('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLyricsPaste]);

  // Inject beLive shimmer animation CSS
  useEffect(() => {
    const id = 'belive-shimmer-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes beLiveShimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <>
      {/* Main Upload Panel */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid #444',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
      }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#ccc',
        marginBottom: 8,
      }}>
        Upload Track
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {CELLS.map(cell => {
          const file = files[cell.key];
          const ref = refs[cell.key];
          return (
            <div key={cell.key} style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
              <input
                ref={ref}
                type="file"
                accept={cell.accept}
                style={{ display: 'none' }}
                onChange={e => handleFile(cell.key, e.target?.files?.[0] ?? null)}
              />
              <div
                onClick={() => ref.current?.click()}
                style={{
                  border: file
                    ? '2px solid #4CAF50'
                    : cell.required
                      ? '2px dashed #FF8C00'
                      : '2px dashed #555',
                  borderRadius: 6,
                  padding: '12px 8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: file ? 'rgba(76,175,80,0.1)' : 'transparent',
                  transition: 'border-color 0.2s, background 0.2s',
                  minHeight: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 20 }}>{cell.icon}</span>
                {file ? (
                  <>
                    <span style={{
                      fontSize: 11, color: '#4CAF50', wordBreak: 'break-all',
                      maxWidth: '100%', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {file.name}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); clearFile(cell.key); }}
                      style={{
                        background: 'none', border: 'none', color: '#e74c3c',
                        cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                      }}
                    >
                      ✕ clear
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 11, color: '#888' }}>
                      {cell.label}
                    </span>
                    {cell.required && (
                      <span style={{ fontSize: 9, color: '#FF8C00' }}>required</span>
                    )}
                  </>
                )}
                
                {/* Lyrics paste button — shown when no file and not in paste mode */}
                {cell.key === 'lyrics' && !file && !showLyricsPaste && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLyricsPaste(true);
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #666',
                      color: '#aaa',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 4,
                      marginTop: 4,
                    }}
                  >
                    📋 Вставить текст
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            background: 'none', border: '1px solid #555', color: '#aaa',
            borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!files.instrumental || saving}
          style={{
            background: files.instrumental && !saving ? '#4CAF50' : '#333',
            color: '#fff', border: 'none',
            borderRadius: 4, padding: '6px 16px',
            cursor: files.instrumental && !saving ? 'pointer' : 'not-allowed',
            fontSize: 12, fontWeight: 600,
            opacity: files.instrumental && !saving ? 1 : 0.5,
          }}
        >
          {saving ? '⏳ Saving...' : 'Save Track'}
        </button>
      </div>
      </div>

      {/* Lyrics Paste Modal */}
      {showLyricsPaste && (
      <>
        {/* Overlay */}
        <div
          onClick={() => { setShowLyricsPaste(false); setPastedText(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
          }}
        />
        {/* Modal */}
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(600px, 90vw)',
            height: '85vh',
            maxHeight: '85vh',
            background: '#0f0f1a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Текст песни
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setLyricsFontSize(s => Math.max(10, s - 1))}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >A-</button>
              <span style={{ color: '#666', fontSize: 11, minWidth: 30, textAlign: 'center' }}>
                {lyricsFontSize}px
              </span>
              <button
                onClick={() => setLyricsFontSize(s => Math.min(20, s + 1))}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >A+</button>
              <button
                onClick={() => { setShowLyricsPaste(false); setPastedText(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >✕</button>
            </div>
          </div>

          {/* TC-GENIUS-001: Genius link block */}
          {pendingTrackTitle && (
            <div style={{
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
            }}>
              <span>Найди текст на</span>
              <a
                href={`https://genius.com/search?q=${encodeURIComponent(pendingTrackTitle || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#ffcf00', // Genius yellow
                  fontWeight: 700,
                  textDecoration: 'none',
                  letterSpacing: '0.5px',
                }}
              >
                ✦ Genius
              </a>
              <span style={{ opacity: 0.4, fontSize: 11, marginLeft: 4 }}>
                {pendingTrackTitle}
              </span>
            </div>
          )}

          {/* Textarea with custom placeholder */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {/* Branded placeholder when empty */}
            {!pastedText && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 20,
                  right: 20,
                  pointerEvents: 'none',
                  color: 'rgba(255, 255, 255, 0.25)',
                  fontSize: lyricsFontSize,
                  fontFamily: "'Roboto Mono', monospace",
                  lineHeight: 1.7,
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <span>Кидай Текст — </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #9b59b6, #8e44ad, #c39bd3, #7d3c98)',
                    backgroundSize: '200% 200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'beLiveShimmer 3s ease-in-out infinite',
                    fontWeight: 700,
                  }}>beLive</span>
                  <span> всё лишнее уберёт сам!</span>
                </div>
                <div style={{ fontSize: Math.max(11, lyricsFontSize - 2), opacity: 0.5 }}>
                  (Ctrl+V)
                </div>
              </div>
            )}
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder=""
              autoFocus
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                minHeight: 0,
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: lyricsFontSize,
                lineHeight: 1.7,
                padding: '16px 20px',
                resize: 'none' as const,
                outline: 'none',
                margin: 0,
                fontFamily: "'Roboto Mono', monospace",
                overflowY: 'auto' as const,
              }}
            />
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <button
              onClick={() => { setShowLyricsPaste(false); setPastedText(''); }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '8px 20px',
                borderRadius: 8,
              }}
            >
              Отмена
            </button>
            <button
              onClick={async () => {
                if (pastedText.trim()) {
                  if (pendingTrackId) {
                    const _t0 = import.meta.env.DEV ? performance.now() : 0;
                    // ZIP context — track already saved, update lyrics field
                    const w = window as any;
                    
                    // W11: сохраняем ЧИСТЫЙ текст (без тегов) — так же как Block Editor
                    const { parseTaggedLyrics } = await import('../blocks/parser/tagged-lyrics.parser');
                    
                    // 007-DEBUG: Log pastedText to see raw Genius input
                    if (import.meta.env.DEV) {
                      console.log('[007-SCAN] Raw pastedText (first 500 chars):');
                      console.log(pastedText.trim().substring(0, 500));
                      console.log('[007-SCAN] Looking for [Bridge] and [Chorus] tags...');
                      const bridgeIdx = pastedText.indexOf('[Bridge');
                      const chorusAfterBridge = pastedText.indexOf('[Chorus', bridgeIdx + 1);
                      if (bridgeIdx >= 0) {
                        console.log(`  [Bridge] found at index: ${bridgeIdx}`);
                        console.log(`  Text after [Bridge] (next 200 chars):`, pastedText.substring(bridgeIdx, bridgeIdx + 200));
                      }
                      if (chorusAfterBridge >= 0) {
                        console.log(`  Next [Chorus] after [Bridge] at index: ${chorusAfterBridge}`);
                        console.log(`  Text between Bridge and Chorus:`, pastedText.substring(bridgeIdx, chorusAfterBridge));
                      } else {
                        console.log('  [007-CRITICAL] NO [Chorus] tag found after [Bridge]!');
                      }
                    }
                    
                    const tagResult = parseTaggedLyrics(pastedText.trim());
                    if (import.meta.env.DEV) console.log(`[LyricsPaste] parseTaggedLyrics: ${(performance.now() - _t0).toFixed(1)}ms`);
                    
                    // 007-DEBUG: Log tagResult.blocks structure
                    if (import.meta.env.DEV && tagResult.hasStructure) {
                      console.log('[007-SCAN] tagResult.blocks:');
                      console.log(`  Total blocks: ${tagResult.blocks.length}`);
                      tagResult.blocks.forEach((b, i) => {
                        console.log(`  Block ${i} [${b.type}]: "${b.label}" — ${b.contentLines.length} contentLines`);
                        if (b.type === 'bridge') {
                          console.log(`    [007-CRITICAL] Bridge contentLines:`, b.contentLines);
                        }
                      });
                    }
                    let cleanLyrics: string;
                    
                    if (tagResult.hasStructure && tagResult.blocks.length >= 1) {
                      // M2: no separator lines — M2 closing marker replaces separator lines
                      const cleanLines: string[] = [];
                      for (const b of tagResult.blocks) {
                        for (const line of b.contentLines) {
                          const trimmed = line.trim();
                          if (trimmed) cleanLines.push(trimmed);
                        }
                      }
                      cleanLyrics = cleanLines.join('\n');
                    } else {
                      // Теги не найдены — используем сырой текст
                      cleanLyrics = pastedText.trim();
                    }

                    // ── PERF: Do matching FIRST (no IDB needed), then single IDB write ──
                    // Old flow: save lyrics(663ms) → getTrack(890ms) → match → save markers(593ms) = 2166ms
                    // New flow: match → single save lyrics+markers = ~600ms

                    let autoSyncApplied = false;
                    let matchResult: { markers: any[]; blocks: any[]; confidence: number } | null = null;

                    try {
                      const autoLyrics = await import('../services/auto-lyrics.service');
                      // W11: ждём кэш максимум 17 сек
                      const lrcResult = pendingTrackTitle
                        ? await autoLyrics.waitForCache(pendingTrackTitle, 17000)
                        : null;
                      if (import.meta.env.DEV) console.log(`[LyricsPaste] waitForCache: ${(performance.now() - _t0).toFixed(1)}ms`);

                      if (!lrcResult && pendingTrackTitle) {
                        w.showNotification?.(
                          'warning',
                          `⚠️ LRC not found for "${pendingTrackTitle}" — manual sync required`,
                        );
                      }

                      if (lrcResult) {
                        // TC-010: Use blockFirstLineSync instead of matchGeniusToLrc
                        // LRC lines = display + timing (drift ≈ 0)
                        // Genius blocks = structure overlay
                        matchResult = autoLyrics.blockFirstLineSync(pastedText.trim(), lrcResult);
                        if (import.meta.env.DEV) {
                          console.log(`[TC-010] confidence=${(matchResult.confidence * 100).toFixed(1)}%`);
                          console.log(`[LyricsPaste] blockFirstLineSync: ${(performance.now() - _t0).toFixed(1)}ms`);
                        }
                      }
                    } catch (err) {
                      console.warn('[AutoLyrics] Auto-sync failed, falling back to manual:', err);
                    }

                    // ── Single IDB write: lyrics + markers + blocks together ──
                    // TC-002: ALWAYS save clean lyrics WITHOUT bracket tags
                    // TC-010: lyricsLines from blockFirstLineSync = LRC lines (already clean)
                    const cleanLyricLines = matchResult && matchResult.confidence >= 0.8
                      ? (matchResult as any).lyricsLines               // from blockFirstLineSync — LRC lines
                      : extractCleanLyrics(pastedText);                // manual path — identical logic

                    const idbFields: Record<string, any> = {
                      lyrics: cleanLyricLines.join('\n'),             // ← WITHOUT bracket tags ALWAYS
                      lyricsOriginalContent: pastedText.trim(),        // ← original with tags
                    };

                    // TC-002: Assertion — track.lyrics must NEVER contain bracket tags
                    if (import.meta.env.DEV) {
                      const bracketLines = cleanLyricLines.filter((l: string) => /^\s*\[[^\]]+\]\s*$/.test(l.trim()));
                      if (bracketLines.length > 0) {
                        console.error(
                          '[TC-002] INVARIANT VIOLATION! track.lyrics contains bracket tags:',
                          bracketLines
                        );
                      }
                      console.log(
                        `[TC-002] Saved lyrics: ${cleanLyricLines.length} lines ` +
                        `(was ${pastedText.split('\n').filter((l: string) => l.trim()).length} with tags)` +
                        `${matchResult && matchResult.confidence >= 0.8 ? ' [auto-sync]' : ' [manual]'}`
                      );
                    }

                    // TC-008: Two-tier confidence threshold
                    const HIGH_CONFIDENCE = 0.8;
                    const LOW_CONFIDENCE_ACCEPT = 0.5;  // minimum threshold for applying markers

                    if (matchResult && matchResult.confidence >= HIGH_CONFIDENCE) {
                      // High confidence — full auto-sync, open Sync Editor
                      idbFields.syncMarkers = matchResult.markers;
                      if (matchResult.blocks.length > 0) idbFields.blocksData = matchResult.blocks;
                    } else if (matchResult && matchResult.confidence >= LOW_CONFIDENCE_ACCEPT) {
                      // Low confidence — apply markers anyway, user will review in Sync Editor
                      idbFields.syncMarkers = matchResult.markers;
                      if (matchResult.blocks.length > 0) idbFields.blocksData = matchResult.blocks;

                      if (import.meta.env.DEV) {
                        console.log(
                          `[TC-008] Low confidence auto-sync applied (${(matchResult.confidence * 100).toFixed(1)}%). ` +
                          `Opening Sync Editor for review. Unmatched lines may need manual markers.`
                        );
                      }
                    } else if (tagResult?.blocks?.length > 0) {
                      // TC-ZIP-03: No LRC match, but tagged lyrics have structure — save blocks as PersistedTextBlock[]
                      idbFields.blocksData = detectedBlocksToPersistedBlocks(tagResult.blocks, cleanLyricLines);
                    }

                    await w.idbService?.updateTrackField(pendingTrackId, idbFields);
                    if (import.meta.env.DEV) {
                      console.log(`[LyricsPaste] IDB save (single): ${(performance.now() - _t0).toFixed(1)}ms`);
                      // ZIP-DIAG: Diagnostic log to verify what was saved to IDB
                      const blocksArr = idbFields.blocksData;
                      console.log('[ZIP-DIAG] idbFields saved:', JSON.stringify({
                        hasBlocks: !!(blocksArr as any[])?.length,
                        blockCount: (blocksArr as any[])?.length ?? 0,
                        firstBlockLines: (blocksArr as any[])?.[0]?.lineIndices?.length ?? -1,
                        firstBlockName: (blocksArr as any[])?.[0]?.name ?? 'none',
                        hasMarkers: !!idbFields.syncMarkers?.length,
                        markerCount: idbFields.syncMarkers?.length ?? 0,
                        hasLyrics: !!idbFields.lyrics,
                        lyricsLength: (idbFields.lyrics as string)?.length ?? 0,
                      }));
                    }

                    // Patch in-memory tc.tracks entry so orchestrator sees fresh data
                    // (orchestrator may skip IDB read if stemsData is already present)
                    const tc = w.trackCatalog;
                    if (tc?.tracks) {
                      const idx = tc.tracks.findIndex((t: any) => t.id === pendingTrackId);
                      if (idx >= 0) Object.assign(tc.tracks[idx], idbFields);
                    }

                    // TC-008: Apply markers if confidence >= LOW_CONFIDENCE_ACCEPT (0.5)
                    if (matchResult && matchResult.confidence >= LOW_CONFIDENCE_ACCEPT) {
                      const autoLyrics = await import('../services/auto-lyrics.service');
                      autoLyrics.markAutoSyncApplied(pendingTrackId);
                      autoSyncApplied = true;

                      if (matchResult.confidence < HIGH_CONFIDENCE) {
                        // LOW_CONFIDENCE (0.5-0.79) — применяем legacy для ревью
                        const mm = (window as any).markerManager;
                        const ld = (window as any).lyricsDisplay;
                        if (mm && matchResult.markers.length > 0) {
                          mm.setMarkers(matchResult.markers);
                          mm.updateMarkerColors?.();
                        }
                        if (ld && matchResult.blocks.length > 0) {
                          ld.textBlocks = matchResult.blocks;
                          ld.activateRehearsalDisplay?.();
                        }
                        w.showNotification?.(
                          'warning',
                          `⚠️ Синхронизация применена (${Math.round(matchResult.confidence * 100)}%). Проверьте маркеры в Sync Editor.`,
                        );
                      } else {
                        // HIGH_CONFIDENCE (>= 0.8) — IDB уже сохранён выше, legacy не трогаем
                        // трек просто появляется в каталоге
                        w.showNotification?.(
                          'success',
                          `✅ Синхронизация готова (${Math.round(matchResult.confidence * 100)}%)`,
                        );
                      }
                    }

                    // ═══ TC-FLOW-02: fallback — открыть sync editor вместо Block Editor ═══
                    if (!autoSyncApplied) {
                      if (import.meta.env.DEV) {
                        console.log('[AutoLyrics] auto-sync not applied, opening Sync Editor');
                      }
                      const track = await w.idbService?.getTrack(pendingTrackId);
                      if (track) {
                        const { loadTrack } = await import('../services/track.actions');
                        const { useTrackStore } = await import('../stores/track.store');
                        const trackIndex = useTrackStore.getState().tracksMeta
                          .findIndex(t => String(t.id) === String(pendingTrackId));
                        if (trackIndex >= 0) {
                          setTimeout(() => {
                            loadTrack(trackIndex, { autoplay: false, openSyncEditor: true });
                          }, 300);
                        }
                      }
                    }
                    onSaved?.();
                    if (import.meta.env.DEV) console.log(`[LyricsPaste] TOTAL: ${(performance.now() - _t0).toFixed(1)}ms`);
                  } else {
                    // Manual upload — standard flow
                    handlePastedLyrics(pastedText.trim());
                  }
                }
                setShowLyricsPaste(false);
                setPastedText('');
              }}
              disabled={!pastedText.trim()}
              style={{
                background: pastedText.trim() ? '#FF8C00' : '#333',
                border: 'none',
                color: '#fff',
                cursor: pastedText.trim() ? 'pointer' : 'default',
                fontSize: 13,
                padding: '8px 24px',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Принять
            </button>
          </div>
        </div>
      </>
    )}
    </>
  );
}
