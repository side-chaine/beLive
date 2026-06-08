import { authService } from '../../services/auth.service';
import './BillyCloud.css';

interface PremiumGateOverlayProps {
  onClose: () => void;
}

/**
 * PremiumGateOverlay — модальный оверлей для гостей.
 * Появляется когда гость пытается спросить Билли.
 */
export function PremiumGateOverlay({ onClose }: PremiumGateOverlayProps) {
  return (
    <div className="bl-premium-gate-overlay" onClick={onClose}>
      <div
        className="bl-premium-gate"
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: '36px',
            marginBottom: '0.75rem',
            opacity: 0.3,
          }}
        >
          🔒
        </div>
        <h3>Войдите, чтобы разблокировать Билли</h3>
        <p>
          ИИ-ассистент доступен только для авторизованных пользователей
        </p>
        <button
          className="bl-premium-gate__btn"
          onClick={() => authService.initiateGoogleOAuth()}
        >
          Войти через Google
        </button>
        <button className="bl-premium-gate__later" onClick={onClose}>
          Позже
        </button>
      </div>
    </div>
  );
}
