// @TC-098-02: FeedPostCard — универсальная карточка для 4 типов постов
// + Mini-TrackMap + battle submissions + type badge + Safari 15 fallback

import { useState, useRef, useEffect } from 'react';
import type { FeedPost } from './feed.types';
import { POST_TYPE_CONFIG } from './feed.types';
import { useFeedStore } from './feed.store';
import { useUserProfileStore } from '../../stores/user-profile.store';

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isOwner = !!(currentUser?.authToken && post.authorId === currentUser.id);
  const canEdit = isOwner;
  const canDeletePost = isOwner;

  const handleEdit = () => {
    setEditingPost(post);
    setComposerOpen(true);
    setMenuOpen(false);
  };

  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}?post=${encodeURIComponent(post.id)}`;
    if (typeof navigator.share !== 'undefined') {
      setIsSharing(true);
      try {
        await navigator.share({ title: post.title || 'beLive', url: shareUrl });
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          await navigator.clipboard?.writeText(shareUrl).catch(() => {});
        }
      } finally {
        setIsSharing(false);
      }
    } else {
      await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    }
    setMenuOpen(false);
  };

  const handleDelete = () => {
    if (confirm('Удалить пост?')) deletePost(post.id);
    setMenuOpen(false);
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
        <div className="fpc-menu-container" ref={menuRef}>
          <button
            className="fpc-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
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
              <button className="fpc-menu-item" role="menuitem" onClick={handleShare}>
                <span className="fpc-menu-icon">⇱</span>
                Поделиться
              </button>
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
