import { authService } from '../../services/auth.service';
import './BillyCloud.css';

interface PremiumGateOverlayProps {
  onClose: () => void;
}

/**
 * PremiumGateOverlay — призыв к регистрации для гостей.
 * Появляется когда гость пытается спросить Билли.
 */
export function PremiumGateOverlay({ onClose }: PremiumGateOverlayProps) {
  return (
    <div className="bl-billy-cloud-overlay" onClick={onClose}>
      <div
        className="bl-billy-cloud bl-billy-cloud--gate"
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
        <h3 style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '17px' }}>
          Войдите, чтобы разблокировать Билли
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '1.25rem',
            lineHeight: 1.5,
          }}
        >
          ИИ-ассистент доступен только для авторизованных пользователей
        </p>
        <button
          className="bl-billy-cloud__gate-btn"
          onClick={() => authService.initiateGoogleOAuth()}
        >
          Войти через Google
        </button>
        <button className="bl-billy-cloud__later-btn" onClick={onClose}>
          Позже
        </button>
      </div>
    </div>
  );
}
