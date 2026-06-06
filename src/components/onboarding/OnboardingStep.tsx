import React from 'react';

interface OnboardingStepProps {
  index: number;
  title: string;
  billyTip: string;
  completed: boolean;
  active: boolean;
  onClick: () => void;
  onComplete: () => void;
  children?: React.ReactNode;
}

export function OnboardingStep({
  index, title, billyTip, completed, active,
  onClick, onComplete, children,
}: OnboardingStepProps) {
  return (
    <div className={`bl-onboarding__step ${active ? 'bl-onboarding__step--active' : ''} ${completed ? 'bl-onboarding__step--completed' : ''}`}>
      <div className="bl-onboarding__step-header" onClick={onClick}>
        <span className="bl-onboarding__step-number">{index}</span>
        <span className="bl-onboarding__step-title">{title}</span>
        <span className="bl-onboarding__check">
          {completed ? '✓' : '○'}
        </span>
      </div>
      {active && (
        <div className="bl-onboarding__step-body">
          <div className="bl-onboarding__billy-tip">{billyTip}</div>
          {children}
          {!completed && (
            <button className="bl-onboarding__complete-btn" onClick={onComplete}>
              Готово
            </button>
          )}
        </div>
      )}
    </div>
  );
}
