import { useModeStore } from '../stores/mode.store';
import { useCameraStore } from '../stores/camera.store';
import styles from './LiveControls.module.css';

export function LiveControls() {
  const mode = useModeStore((s) => s.mode);
  const cameraOn = useCameraStore((s) => s.cameraOn);
  const startCamera = useCameraStore((s) => s.startCamera);
  const stopCamera = useCameraStore((s) => s.stopCamera);
  const flipCamera = useCameraStore((s) => s.flipCamera);

  if (mode !== 'live') return null;

  const handleToggle = () => {
    if (cameraOn) stopCamera();
    else startCamera();
  };

  return (
    <div className={styles.container}>
      <button
        className={`${styles.btn} ${cameraOn ? styles.btnActive : ''}`}
        onClick={handleToggle}
        title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {cameraOn ? '📷' : '📷'}
      </button>
      {cameraOn && (
        <button
          className={styles.btn}
          onClick={flipCamera}
          title="Flip camera"
        >
          🔄
        </button>
      )}
    </div>
  );
}

