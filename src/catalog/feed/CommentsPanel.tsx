// @TC-108-05: CommentsPanel — full implementation (rewrite from stub)
// XSS GUARD: text rendered via {comment.text} only — NEVER dangerouslySetInnerHTML

import { useEffect, useRef, useState } from 'react';
import { useFeedStore } from './feed.store';
import { useUserProfileStore } from '../../stores/user-profile.store';

interface Props {
  onClose?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  return `${days} дн назад`;
}

export function CommentsPanel({ onClose }: Props) {
  const activePostId = useFeedStore(s => s.activePostId);
  const posts = useFeedStore(s => s.posts);
  const comments = useFeedStore(s => s.comments);
  const commentsStatus = useFeedStore(s => s.commentsStatus);
  const fetchComments = useFeedStore(s => s.fetchComments);
  const createComment = useFeedStore(s => s.createComment);
  const deleteComment = useFeedStore(s => s.deleteComment);
  const setActivePost = useFeedStore(s => s.setActivePost);

  const currentUser = useUserProfileStore(s => s.currentUser);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const post = posts.find(p => p.id === activePostId);
  const postComments = activePostId ? comments[activePostId] || [] : [];
  const status = activePostId ? commentsStatus[activePostId] || 'idle' : 'idle';

  useEffect(() => {
    if (activePostId && status === 'idle') {
      fetchComments(activePostId);
    }
  }, [activePostId, status, fetchComments]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [postComments.length]);

  const handleClose = () => {
    setActivePost(null);
    onClose?.();
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activePostId || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      await createComment(activePostId, text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!activePostId) return;
    await deleteComment(activePostId, commentId);
  };

  if (!post) {
    return (
      <div className="cp-empty">
        <span className="cp-icon">💬</span>
        <p>Выберите пост</p>
        <p className="cp-sub">Нажмите 💬 чтобы открыть чат</p>
      </div>
    );
  }

  return (
    <div className="cp">
      <div className="cp-head">
        <span className="cp-title">Комментарии</span>
        <button className="cp-x" onClick={handleClose}>✕</button>
      </div>

      <div className="cp-preview">
        <strong>{post.authorName}</strong>: {post.title}
      </div>

      <div className="cp-list" ref={listRef}>
        {status === 'loading' && (
          <div className="cp-loading">Загрузка…</div>
        )}
        {status === 'error' && (
          <div className="cp-error">Ошибка загрузки</div>
        )}
        {status === 'ready' && postComments.length === 0 && (
          <div className="cp-empty-list">
            <p>Нет комментариев</p>
            <p className="cp-empty-sub">Будьте первым!</p>
          </div>
        )}
        {postComments.map(comment => {
          const isOwn = comment.authorId === currentUser?.id;
          return (
            <div key={comment.id} className="cp-item">
              <div className="cp-avatar">
                {comment.authorAvatarUrl ? (
                  <img src={comment.authorAvatarUrl} alt="" />
                ) : (
                  <div className="cp-avatar-fallback">
                    {comment.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="cp-item-body">
                <div className="cp-item-header">
                  <span className="cp-item-name">{comment.authorName}</span>
                  <span className="cp-item-time">{timeAgo(comment.createdAt)}</span>
                  {isOwn && (
                    <button
                      className="cp-item-delete"
                      onClick={() => handleDelete(comment.id)}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                {/* XSS GUARD: {comment.text} — React auto-escapes. NO dangerouslySetInnerHTML. */}
                <p className="cp-item-text">{comment.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cp-form">
        <textarea
          className="cp-input"
          placeholder="Введите комментарий…"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          rows={2}
        />
        <button
          className="cp-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? '…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}
