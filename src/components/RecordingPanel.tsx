import { useRecordingStore } from '../stores/recording.store';
import styles from './RecordingPanel.module.css';

export function RecordingPanel() {
  const isRecording = useRecordingStore(s => s.isRecording);
  const duration = useRecordingStore(s => s.duration);
  const error = useRecordingStore(s => s.error);
  const startRecording = useRecordingStore(s => s.startRecording);
  const stopRecording = useRecordingStore(s => s.stopRecording);

  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');

  return (
    <div className={styles.root}>
      <button
        className={styles.recBtn}
        data-recording={String(isRecording)}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? (
          <>■ Stop</>
        ) : (
          <>● Record</>
        )}
      </button>

      {isRecording && (
        <>
          <span className={styles.dot} />
          <span className={styles.timer}>{mm}:{ss}</span>
        </>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
