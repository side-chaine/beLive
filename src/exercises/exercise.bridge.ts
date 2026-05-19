import { useExerciseStore } from './exercise.store';
import { useTakesStore } from '../takes/takes.store';

export function initExerciseBridge(): () => void {
  const handleTrackChange = () => {
    useExerciseStore.getState().cancelExercise();
  };

  document.addEventListener('before-track-change', handleTrackChange);

  let prevIsRecording = useTakesStore.getState().isRecording;

  const unsubTakes = useTakesStore.subscribe((state) => {
    const isRecording = state.isRecording;
    const exercise = useExerciseStore.getState();

    // pre-recording → recording
    if (!prevIsRecording && isRecording && exercise.phase === 'pre-recording') {
      exercise.setPhase('recording');
    }

    // recording → completed step
    if (prevIsRecording && !isRecording && exercise.phase === 'recording') {
      exercise.onStepCompleted();
    }

    prevIsRecording = isRecording;
  });

  return () => {
    document.removeEventListener('before-track-change', handleTrackChange);
    unsubTakes();
  };
}
