// @TC-098-02: FeedPostCard — универсальная карточка для 4 типов постов
// + Mini-TrackMap + battle submissions + type badge + Safari 15 fallback

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FeedPost } from './feed.types';
import { POST_TYPE_CONFIG } from './feed.types';
import { useFeedStore } from './feed.store';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { showAppNotification } from '../../utils/notification';

interface Props {
  post: FeedPost;
}

export function FeedPostCard({ post }: Props) {
  const toggleLike = useFeedStore(s => s.toggleLike);
  const voteSubmission = useFeedStore(s => s.voteSubmission);
  const closeBattle = useFeedStore(s => s.closeBattle);
  const setActivePost = useFeedStore(s => s.setActivePost);
  const deletePost = useFeedStore(s => s.deletePost);
  const setEditingPost = useFeedStore(s => s.setEditingPost);
  const setComposerOpen = useFeedStore(s => s.setComposerOpen);
  const currentUser = useUserProfileStore(s => s.currentUser);

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePos, setSharePos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const shareBtnRef = useRef<HTMLButtonElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const firstCircleRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!menuOpen && !shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (shareOpen && shareRef.current && !shareRef.current.contains(e.target as Node)
          && shareBtnRef.current && !shareBtnRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, shareOpen]);

  useEffect(() => {
    if (!shareOpen) return;
    const lastY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastY) > 8) {
        setShareOpen(false);
        shareBtnRef.current?.focus();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shareOpen]);

  useEffect(() => {
    if (shareOpen && firstCircleRef.current) {
      firstCircleRef.current.focus();
    }
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShareOpen(false);
        shareBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shareOpen]);

  const isOwner = !!(currentUser?.authToken && post.authorId === currentUser.id);
  const canEdit = isOwner;
  const canDeletePost = isOwner;

  const handleEdit = () => {
    setEditingPost(post);
    setComposerOpen(true);
    setMenuOpen(false);
  };

  const handleShareToggle = () => {
    if (shareBtnRef.current) {
      const rect = shareBtnRef.current.getBoundingClientRect();
      const panelWidth = Math.min(360, window.innerWidth - 32);
      let left = rect.right - panelWidth;
      if (left < 16) left = 16;
      setSharePos({ top: rect.bottom + 8, left });
    }
    setShareOpen(s => !s);
    setMenuOpen(false);
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    setConfirmDelete(true);
    setMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    setConfirmDelete(false);
    await deletePost(post.id);
  };

  const cfg = POST_TYPE_CONFIG[post.type];
  const timeAgo = fmtTimeAgo(post.createdAt);
  const isEdited = !!(post.updatedAt && post.updatedAt > post.createdAt);

  return (
    <article className="fpc" data-type={post.type}>
      <div className="fpc-header">
        <div className="fpc-avatar">
          {post.authorAvatarUrl
            ? <img src={post.authorAvatarUrl} alt={post.authorName} />
            : <div className="fpc-avatar-fallback">{post.authorName.charAt(0)}</div>
          }
        </div>
        <div className="fpc-meta">
          <span className="fpc-author">{post.authorName}</span>
          <span className="fpc-time">{timeAgo}</span>
        </div>
        <span
          className="fpc-badge"
          style={{ '--badge-color': cfg.color } as React.CSSProperties}
        >
          {cfg.emoji} {cfg.label}
        </span>
        <div className="fpc-header-right">
          <button
            ref={shareBtnRef}
            className={`fpc-share-btn${shareOpen ? ' fpc-share-btn--spinning' : ''}`}
            onClick={handleShareToggle}
            aria-haspopup="dialog"
            aria-expanded={shareOpen}
            aria-label="Поделиться"
            aria-controls="fpc-share-popover"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
              <path d="M12 2v13M12 2L7 7M12 2l5 5M5 12v8a2 2 0 002 2h10a2 2 0 002-2v-8"
                    stroke="currentColor" stroke-width="2" fill="none"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div className="fpc-menu-container" ref={menuRef}>
            <button
              className="fpc-menu-btn"
              onClick={() => { setMenuOpen(o => !o); setShareOpen(false); }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Меню поста"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="fpc-menu-dropdown" role="menu">
                {canEdit && (
                  <button className="fpc-menu-item" role="menuitem" onClick={handleEdit}>
                    <span className="fpc-menu-icon">✎</span>
                    Редактировать
                  </button>
                )}
                {canDeletePost && (
                  <button className="fpc-menu-item fpc-menu-item--danger" role="menuitem" onClick={handleDelete}>
                    <span className="fpc-menu-icon">✕</span>
                    Удалить
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fpc-body">
        <h3 className="fpc-title">
          {post.title}
          {isEdited && <span className="fpc-edited-badge">ред.</span>}
        </h3>
        {post.text && <p className="fpc-text">{post.text}</p>}

        {post.blocksData && post.blocksData.length > 0 && (
          <div className="mtm">
            {post.blocksData.map(block => (
              <div
                key={block.id}
                className={
                  'mtm-block' +
                  (block.isActive ? ' is-active' : '') +
                  (post.type === 'battle' && !block.isActive ? ' is-dimmed' : '')
                }
                style={{
                  width: `${block.widthPercent}%`,
                  backgroundColor: block.color,
                }}
              >
                {block.label}
              </div>
            ))}
            <div className="mtm-play">▶</div>
          </div>
        )}

        {post.type === 'battle' && post.submissions && post.submissions.length > 0 && (
          <div className="fpc-subs">
            {post.submissions.map(sub => (
              <div key={sub.id} className="fpc-sub">
                <div className="fpc-sub-avatar">
                  {sub.userName.charAt(0)}
                </div>
                <div className="fpc-sub-info">
                  <span className="fpc-sub-name">
                    {sub.userName}
                    {sub.isAuthor && <span className="fpc-sub-author"> (автор)</span>}
                  </span>
                  {sub.isWinner && <span className="fpc-sub-label">🏆 Победитель</span>}
                </div>
                <button className="fpc-sub-play">▶</button>
                <button
                  className="fpc-vote-btn"
                  onClick={() => voteSubmission(post.id, sub.id)}
                  title="Голосовать"
                >
                  👍 {sub.votes}
                </button>
              </div>
            ))}
            {post.battleStatus === 'open' ? (
              <>
              <div className="fpc-sub-add">
                <span>➕ Записать свой вариант</span>
                <span className="fpc-sub-add-desc">V-Mix: ориг. вокал ← інстр. → микрофон</span>
              </div>
              <button
                className="fpc-close-btn"
                onClick={() => closeBattle(post.id)}
              >
                🔒 Закрыть битву
              </button>
              </>
            ) : (
              <div className="fpc-closed-badge">🔒 Битва завершена</div>
            )}
          </div>
        )}

        {post.type === 'event' && (
          <div className="fpc-extras">
            {post.eventDate && <span className="fpc-tag">📅 {fmtEventDate(post.eventDate)}</span>}
            {post.eventPrice && <span className="fpc-tag fpc-tag--accent">{post.eventPrice}</span>}
            {post.eventLocation && <span className="fpc-tag">📍 {post.eventLocation}</span>}
          </div>
        )}
      </div>

      <div className="fpc-actions">
        <button
          className={`fpc-act${post.isLikedByUser ? ' is-liked' : ''}`}
          onClick={() => toggleLike(post.id)}
        >
          {post.isLikedByUser ? '❤️' : '🤍'} {post.likesCount}
        </button>
        <button className="fpc-act" onClick={() => setActivePost(post.id)}>
          💬 {post.commentsCount}
        </button>
        <button className="fpc-act">🔗</button>
        {post.reactions && post.reactions.length > 0 && (
          <span className="fpc-reactions">
            {post.reactions.map(r => (
              <span key={r.emoji} className="fpc-reaction">
                {r.emoji} {r.count}
              </span>
            ))}
          </span>
        )}
      </div>

      {shareOpen && createPortal(
        <div className="fpc-share-popover" ref={shareRef}
             id="fpc-share-popover" role="dialog" aria-label="Поделиться"
             style={{ top: sharePos.top, left: sharePos.left }}>
          <div className="fpc-share-panel">
            <div className="fpc-share-circles">
              {/* Telegram */}
              <a className="fpc-share-circle fpc-share-circle--tg"
                 ref={firstCircleRef}
                 href={`https://t.me/share/url?url=${enc(shareUrl(post.id))}&text=${enc(post.title)}`}
                 target="_blank" rel="noopener noreferrer"
                 aria-label="Поделиться в Telegram">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                <span className="fpc-share-circle-label">Telegram</span>
              </a>
              {/* VK */}
              <a className="fpc-share-circle fpc-share-circle--vk"
                 href={`https://vk.com/share.php?url=${enc(shareUrl(post.id))}&title=${enc(post.title)}`}
                 target="_blank" rel="noopener noreferrer"
                 aria-label="Поделиться во VK">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M11.592 0C5.185 0 0 5.185 0 11.592c0 6.406 5.185 11.591 11.592 11.591 6.406 0 11.591-5.185 11.591-11.591C23.183 5.185 17.998 0 11.592 0zm6.842 16.908h-1.878c-.705 0-.93-.54-2.443-2.07-.694-.665-1.003-.757-1.18-.757-.246 0-.317.07-.317.74v1.815c0 .44-.127.663-1.098.663a6.811 6.811 0 01-4.287-2.64c-.899-1.25-1.599-2.555-1.868-3.308-.105-.298-.02-.47.363-.47h1.878c.415 0 .585.2.735.663.726 2.002 1.645 3.562 2.716 3.562.136 0 .212-.068.212-.55v-2.074c-.043-.937-.548-1.017-.548-1.355a.394.394 0 01.395-.375h2.617c.35 0 .47.176.47.583v3.09c0 .375.16.5.258.5.21 0 .385-.125.767-.5 1.036-1.144 1.633-2.672 1.633-2.672.098-.216.287-.374.665-.374h1.878c.476 0 .577.25.476.585-.39 1.211-2.352 3.693-2.352 3.693-.272.372-.204.56 0 .88.167.267.998 1.041 1.438 1.483.482.513.791.938.886 1.207.182.563-.137.827-.716.827z"/></svg>
                <span className="fpc-share-circle-label">VK</span>
              </a>
              {/* Max */}
              <button className="fpc-share-circle fpc-share-circle--max"
                      onClick={() => { navigator.clipboard.writeText(shareUrl(post.id))
                        .then(() => showAppNotification('Ссылка скопирована — вставь в Max', 'success'))
                        .catch(() => showAppNotification('Не удалось скопировать', 'error')); }}
                      aria-label="Поделиться в Max">
                <span className="fpc-share-circle-symbol">M</span>
                <span className="fpc-share-circle-label">Max</span>
              </button>
              {/* X */}
              <a className="fpc-share-circle fpc-share-circle--x"
                 href={`https://twitter.com/intent/tweet?url=${enc(shareUrl(post.id))}&text=${enc(post.title)}`}
                 target="_blank" rel="noopener noreferrer"
                 aria-label="Поделиться в X">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                <span className="fpc-share-circle-label">X</span>
              </a>
              {/* Instagram */}
              <button className="fpc-share-circle fpc-share-circle--ig"
                      onClick={() => { navigator.clipboard.writeText(shareUrl(post.id))
                        .then(() => showAppNotification('Ссылка скопирована — вставь в Instagram', 'success'))
                        .catch(() => showAppNotification('Не удалось скопировать', 'error')); }}
                      aria-label="Поделиться в Instagram">
                <span className="fpc-share-circle-symbol">IG</span>
                <span className="fpc-share-circle-label">Instagram</span>
              </button>
              {/* Копировать */}
              <button className="fpc-share-circle fpc-share-circle--copy"
                      onClick={() => { navigator.clipboard.writeText(shareUrl(post.id))
                        .then(() => showAppNotification('Ссылка скопирована', 'success'))
                        .catch(() => showAppNotification('Не удалось скопировать', 'error')); }}
                      aria-label="Копировать ссылку">
                <span className="fpc-share-circle-symbol">🔗</span>
                <span className="fpc-share-circle-label">Копировать</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDelete && (
        <div className="feed-confirm-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="feed-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p>Удалить пост?</p>
            <div className="feed-confirm-actions">
              <button onClick={() => setConfirmDelete(false)}>Отмена</button>
              <button className="feed-confirm-danger" onClick={handleConfirmDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function fmtTimeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}

function fmtEventDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  } catch { return s; }
}

const shareUrl = (postId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL || '/'}?post=${encodeURIComponent(postId)}`;

const enc = (s: string) => encodeURIComponent(s);
