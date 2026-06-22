import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ShareModal.css';

interface ShareModalProps {
  post: { id: string; title: string };
  onClose: () => void;
}

const shareUrl = (postId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL || '/'}feed?post=${encodeURIComponent(postId)}`;

const SOCIALS = [
  { name: 'Telegram', url: (u: string, t: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { name: 'VK', url: (u: string, t: string) => `https://vk.com/share.php?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}` },
  { name: 'Twitter / X', url: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { name: 'Email', url: (u: string, t: string) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}` },
];

export function ShareModal({ post, onClose }: ShareModalProps) {
  const url = shareUrl(post.id);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Ссылка скопирована');
    } catch {
      showToast('Не удалось скопировать');
    }
  }, [url, showToast]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title: post.title, url });
      onClose();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[Share] Web Share API error:', e);
        // Fallback to modal — user sees it anyway
      }
    }
  }, [post.title, url, onClose]);

  useEffect(() => {
    if (typeof navigator.share !== 'undefined') {
      handleNativeShare();
    }
  }, [handleNativeShare]);

  // Если navigator.share отработал — модалка закроется, else показываем fallback
  if (typeof navigator.share !== 'undefined') return null;

  const handleSocial = (socialUrl: string) => {
    window.open(socialUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return createPortal(
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button className="share-modal-close" onClick={onClose} aria-label="Закрыть">✕</button>
        <h3 id="share-title" className="share-modal-title">Поделиться</h3>
        <div className="share-modal-url-preview">{post.title}</div>
        <div className="share-modal-grid">
          {SOCIALS.map(s => (
            <button key={s.name} className="share-modal-btn" onClick={() => handleSocial(s.url(url, post.title))}>
              {s.name}
            </button>
          ))}
        </div>
        <button className="share-modal-copy" onClick={copyLink}>
          Копировать ссылку
        </button>
        {toast && <div className="share-modal-toast">{toast}</div>}
      </div>
    </div>,
    document.body
  );
}
