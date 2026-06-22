import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ShareModal.css';

interface ShareModalProps {
  post: { id: string; title: string };
  onClose: () => void;
}

const shareUrl = (postId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL || '/'}?post=${encodeURIComponent(postId)}`;

const enc = (s: string) => encodeURIComponent(s);

export function ShareModal({ post, onClose }: ShareModalProps) {
  const url = shareUrl(post.id);
  const title = post.title || 'beLive';
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const copyToClipboard = useCallback((label: string) => {
    navigator.clipboard.writeText(url)
      .then(() => showToast(`${label}`, 'success'))
      .catch(() => showToast('Не удалось скопировать', 'error'));
  }, [url, showToast]);

  const handleInstagram = useCallback(() => {
    copyToClipboard('Ссылка скопирована — вставь в Instagram');
  }, [copyToClipboard]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, url });
      onClose();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        showToast('Ошибка при открытии', 'error');
      }
    }
  }, [title, url, onClose, showToast]);

  const handleSocial = (socialUrl: string) => {
    window.open(socialUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <button className="share-close" onClick={onClose}>✕</button>
        <h3 className="share-title">Поделиться</h3>

        <div className="share-grid">
          {/* Telegram */}
          <a className="share-circle share-circle--tg"
             href={`https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`}
             target="_blank" rel="noopener noreferrer"
             aria-label="Поделиться в Telegram">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <span className="share-circle-label">Telegram</span>
          </a>

          {/* VK */}
          <a className="share-circle share-circle--vk"
             href={`https://vk.com/share.php?url=${enc(url)}&title=${enc(title)}`}
             target="_blank" rel="noopener noreferrer"
             aria-label="Поделиться во VK">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M11.592 0C5.185 0 0 5.185 0 11.592c0 6.406 5.185 11.591 11.592 11.591 6.406 0 11.591-5.185 11.591-11.591C23.183 5.185 17.998 0 11.592 0zm6.842 16.908h-1.878c-.705 0-.93-.54-2.443-2.07-.694-.665-1.003-.757-1.18-.757-.246 0-.317.07-.317.74v1.815c0 .44-.127.663-1.098.663a6.811 6.811 0 01-4.287-2.64c-.899-1.25-1.599-2.555-1.868-3.308-.105-.298-.02-.47.363-.47h1.878c.415 0 .585.2.735.663.726 2.002 1.645 3.562 2.716 3.562.136 0 .212-.068.212-.55v-2.074c-.043-.937-.548-1.017-.548-1.355a.394.394 0 01.395-.375h2.617c.35 0 .47.176.47.583v3.09c0 .375.16.5.258.5.21 0 .385-.125.767-.5 1.036-1.144 1.633-2.672 1.633-2.672.098-.216.287-.374.665-.374h1.878c.476 0 .577.25.476.585-.39 1.211-2.352 3.693-2.352 3.693-.272.372-.204.56 0 .88.167.267.998 1.041 1.438 1.483.482.513.791.938.886 1.207.182.563-.137.827-.716.827z"/></svg>
            <span className="share-circle-label">VK</span>
          </a>

          {/* WhatsApp */}
          <a className="share-circle share-circle--wa"
             href={`https://wa.me/?text=${enc(title + ' ' + url)}`}
             target="_blank" rel="noopener noreferrer"
             aria-label="Поделиться в WhatsApp">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span className="share-circle-label">WhatsApp</span>
          </a>

          {/* X */}
          <a className="share-circle share-circle--x"
             href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`}
             target="_blank" rel="noopener noreferrer"
             aria-label="Поделиться в X">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className="share-circle-label">X</span>
          </a>

          {/* Instagram */}
          <button className="share-circle share-circle--ig" onClick={handleInstagram} aria-label="Поделиться в Instagram">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            <span className="share-circle-label">Instagram</span>
          </button>
        </div>

        <button className="share-copy-btn" onClick={() => copyToClipboard('Ссылка скопирована')}>
          Копировать ссылку
        </button>

        {typeof navigator.share !== 'undefined' && (
          <button className="share-more-btn" onClick={handleNativeShare}>
            Ещё...
          </button>
        )}

        {toast && (
          <div className={`share-toast share-toast--${toast.type}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
