import { useState, useRef, useCallback, useEffect } from 'react';
import { resetUploadSession, handleFileSelect, clearFile as clearUploadFile, saveTrack, cancelUpload } from '../services/upload.actions';

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
}

const CELLS = [
  { key: 'instrumental' as const, label: 'Instrumental', icon: '🎵', accept: 'audio/*', required: true },
  { key: 'vocal' as const,        label: 'Vocals',       icon: '🎤', accept: 'audio/*', required: false },
  { key: 'lyrics' as const,       label: 'Lyrics',       icon: '📝', accept: '.txt,.text,.lrc,.md,.rtf,.doc,.docx,.srt,.sub,.vtt,.ass,.ssa,.xml,.json,.csv,text/plain,text/rtf,application/rtf,application/msword,text/*', required: false },
] as const;

export function UploadPanel({ onClose, onSaved }: Props) {
  const [files, setFiles] = useState<UploadFiles>({
    instrumental: null,
    vocal: null,
    lyrics: null,
  });
  const [saving, setSaving] = useState(false);

  const instRef = useRef<HTMLInputElement>(null);
  const vocRef = useRef<HTMLInputElement>(null);
  const lyrRef = useRef<HTMLInputElement>(null);
  const refs = { instrumental: instRef, vocal: vocRef, lyrics: lyrRef };

  // Reset legacy uploadSession on mount
  useEffect(() => {
    resetUploadSession();
  }, []);

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

  return (
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
            <div key={cell.key} style={{ flex: 1 }}>
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
  );
}
