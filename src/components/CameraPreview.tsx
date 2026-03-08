import { useEffect, useRef } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useCameraStore } from '../stores/camera.store';
import styles from './CameraPreview.module.css';

export function CameraPreview() {
  const mode = useModeStore((s) => s.mode);
  const stream = useCameraStore((s) => s.stream);
  const cameraOn = useCameraStore((s) => s.cameraOn);
  const error = useCameraStore((s) => s.error);
  const stopCamera = useCameraStore((s) => s.stopCamera);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop camera when leaving Live mode
  useEffect(() => {
    if (mode !== 'live') {
      stopCamera();
    }
  }, [mode, stopCamera]);

  if (mode !== 'live') return null;

  return (
    <div className={styles.container}>
      {cameraOn && stream ? (
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          muted
        />
      ) : (
        <div className={styles.off}>
          {error === 'denied' ? '📷 ✕' : '📷'}
        </div>
      )}
    </div>
  );
}

