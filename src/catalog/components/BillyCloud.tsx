import { useEffect } from 'react';
import { AiExpertPanel } from '../../components/TrackInfoBoard/AiExpertPanel';
import './BillyCloud.css';

interface BillyCloudProps {
  initialQuestion: string;
  onClose: () => void;
}

/**
 * BillyCloud — inline-панель чата Билли внутри каталога.
 * Рендерится под блоком шагов, НЕ как bottom-sheet.
 * Использует AiExpertPanel в standalone + compact режиме.
 * ESC закрывает.
 */
export function BillyCloud({ initialQuestion, onClose }: BillyCloudProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="bl-billy-cloud">
      <div className="bl-billy-cloud__header">
        <span>🤖 Спроси Билли</span>
        <button
          className="bl-billy-cloud__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
      <div className="bl-billy-cloud__body">
        <AiExpertPanel
          compact
          standalone
          initialMessage={initialQuestion}
        />
      </div>
    </div>
  );
}
