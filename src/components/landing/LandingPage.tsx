import { useState, useEffect } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [visible, setVisible] = useState(false);
  const [billyScale, setBillyScale] = useState(0.6);

  useEffect(() => {
    // Staggered entrance animation
    requestAnimationFrame(() => {
      setVisible(true);
      setTimeout(() => setBillyScale(1), 200);
    });
  }, []);

  return (
    <div className="landing-root">
      <div className="landing-content">
        <div className="landing-billy" style={{ transform: `scale(${billyScale})` }}>
          🎤
        </div>
        <h1 className={`landing-title ${visible ? 'visible' : ''}`}>
          beLive
        </h1>
        <p className={`landing-subtitle ${visible ? 'visible' : ''}`}>
          Твоя вокальная студия
        </p>
        <button 
          className={`landing-start-btn ${visible ? 'visible' : ''}`}
          onClick={onStart}
        >
          Начать
        </button>
      </div>
    </div>
  );
}
