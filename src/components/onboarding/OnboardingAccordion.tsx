import { useEffect } from 'react';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useTrackStore } from '../../stores/track.store';
import { OnboardingStep } from './OnboardingStep';
import './onboarding.css';

interface Props {
  onActiveStepChange: (step: number) => void;
}

export function OnboardingAccordion({ onActiveStepChange }: Props) {
  const progress = useUserProfileStore(s => s.onboardingProgress);
  const setProgress = useUserProfileStore(s => s.setOnboardingProgress);
  const onboardingComplete = useUserProfileStore(s => s.catalogOnboardingComplete);
  const setComplete = useUserProfileStore(s => s.setCatalogOnboardingComplete);
  const step3Done = useTrackStore(s => s.tracksMeta.length > 0);

  const activeStep = progress.activeStep;
  const step1Done = progress.step1Done;
  const step2Done = progress.step2Done;

  // Auto-progress: шаг 1 → 2
  useEffect(() => {
    if (step1Done && !step2Done && activeStep === 1) {
      setProgress({ activeStep: 2 });
      onActiveStepChange(2);
    }
  }, [step1Done]);

  // Auto-progress: шаг 2 → 3
  useEffect(() => {
    if (step2Done && activeStep === 2) {
      setProgress({ activeStep: 3 });
      onActiveStepChange(3);
    }
  }, [step2Done]);

  // Step 3 auto-highlight when track loaded
  useEffect(() => {
    if (step3Done) onActiveStepChange(3);
  }, [step3Done]);

  const handleStepClick = (step: number) => {
    setProgress({ activeStep: step });
    onActiveStepChange(step);
  };

  return (
    <div className="bl-onboarding">
      <div className="bl-onboarding__header">🎤 Билли поможет начать!</div>

      <OnboardingStep
        index={1}
        title="Разделить трек"
        billyTip='Загрузи трек → нажми «Разделить» → скачай ZIP'
        completed={step1Done}
        active={activeStep === 1}
        onClick={() => handleStepClick(1)}
        onComplete={() => setProgress({ step1Done: true })}
      >
        <a
          href="https://mvsep.com/ru"
          target="_blank"
          rel="noopener noreferrer"
          className="bl-onboarding__link"
        >
          Открыть mvsep.com →
        </a>
      </OnboardingStep>

      <OnboardingStep
        index={2}
        title="Переименовать ZIP"
        billyTip="Назови файл точно как трек"
        completed={step2Done}
        active={activeStep === 2}
        onClick={() => handleStepClick(2)}
        onComplete={() => setProgress({ step2Done: true })}
      >
        <div className="bl-onboarding__example">
          Linkin Park — Breaking the Habit.zip
        </div>
      </OnboardingStep>

      <OnboardingStep
        index={3}
        title="Загрузить в beLive"
        billyTip={step3Done
          ? '🎉 Трек загружен! Текст найди на Genius — ссылка появится рядом 👇'
          : 'Перетащи ZIP сюда →'}
        completed={step3Done}
        active={activeStep === 3}
        onClick={() => handleStepClick(3)}
        onComplete={() => {}}
      >
        {!step3Done && (
          <div className="bl-onboarding__drop-hint">
            Drop zone подсвечена справа →
          </div>
        )}
        {step3Done && !onboardingComplete && (
          <button
            className="bl-onboarding__success-btn"
            onClick={() => setComplete(true)}
          >
            Понятно ✓
          </button>
        )}
      </OnboardingStep>
    </div>
  );
}
