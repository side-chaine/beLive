// @TC-108-05: CommentsPanel — full implementation
// @TC-109-18: + replies, reactions, timecode
// XSS GUARD: text rendered via {comment.text} only — NEVER dangerouslySetInnerHTML

import { useEffect, useRef, useState } from 'react';
import { useFeedStore } from './feed.store';
import { useUserProfileStore } from '../../stores/user-profile.store';

const MUSIC_REACTIONS = ['🔥', '🎵', '🎤'] as const;

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

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FEEDBACK_LABELS: Record<string, string> = {
  vocals: '🎤 Вокал',
  mix: '🎛 Микс',
  lyrics: '📝 Текст',
  arrangement: '🎸 Аранж',
  vibe: '💫 Вайб',
};

export function CommentsPanel({ onClose }: Props) {
  const activePostId = useFeedStore(s => s.activePostId);
  const posts = useFeedStore(s => s.posts);
  const comments = useFeedStore(s => s.comments);
  const commentsStatus = useFeedStore(s => s.commentsStatus);
  const postReactions = useFeedStore(s => s.postReactions);
  const reactionCounts = useFeedStore(s => s.reactionCounts);
  const fetchComments = useFeedStore(s => s.fetchComments);
  const createComment = useFeedStore(s => s.createComment);
  const deleteComment = useFeedStore(s => s.deleteComment);
  const toggleReaction = useFeedStore(s => s.toggleReaction);
  const fetchReactions = useFeedStore(s => s.fetchReactions);
  const setActivePost = useFeedStore(s => s.setActivePost);

  const currentUser = useUserProfileStore(s => s.currentUser);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const post = posts.find(p => p.id === activePostId);
  const postComments = activePostId ? comments[activePostId] || [] : [];
  const status = activePostId ? commentsStatus[activePostId] || 'idle' : 'idle';

  // Separate top-level comments from replies
  const topLevelComments = postComments.filter(c => !c.parentId);
  const repliesByParent = postComments.reduce<Record<string, typeof postComments>>((acc, c) => {
    if (c.parentId) {
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  useEffect(() => {
    if (activePostId && status === 'idle') {
      fetchComments(activePostId);
    }
  }, [activePostId, status, fetchComments]);

  // Fetch reactions when post opens
  useEffect(() => {
    if (activePostId) {
      fetchReactions(activePostId);
    }
  }, [activePostId, fetchReactions]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [postComments.length]);

  const handleClose = () => {
    setActivePost(null);
    setReplyTo(null);
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
      setReplyTo(null);
    }
  };

  const handleReplySend = async () => {
    if (!inputText.trim() || !activePostId || !replyTo || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      await createComment(activePostId, text, replyTo);
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (replyTo) handleReplySend();
      else handleSend();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!activePostId) return;
    await deleteComment(activePostId, commentId);
  };

  const handleReaction = async (emoji: string) => {
    if (!activePostId) return;
    await toggleReaction(activePostId, emoji);
  };

  const renderComment = (comment: any, isReply = false) => {
    const isOwn = comment.authorId === currentUser?.id;
    const replies = repliesByParent[comment.id] || [];

    return (
      <div key={comment.id} style={{ marginLeft: isReply ? 40 : 0 }}>
        <div className="cp-item">
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
              {comment.timecodePin != null && (
                <span className="cp-timecode">⏱ {formatTimecode(comment.timecodePin)}</span>
              )}
              <span className="cp-item-time">{timeAgo(comment.createdAt)}</span>
              {isOwn && (
                <button className="cp-item-delete" onClick={() => handleDelete(comment.id)} title="Удалить">🗑️</button>
              )}
            </div>
            {comment.feedbackTag && FEEDBACK_LABELS[comment.feedbackTag] && (
              <span className="cp-feedback-tag">{FEEDBACK_LABELS[comment.feedbackTag]}</span>
            )}
            {/* XSS GUARD: {comment.text} — React auto-escapes */}
            <p className="cp-item-text">{comment.text}</p>
            {!isReply && (
              <button
                className="cp-reply-btn"
                onClick={() => { setReplyTo(comment.id); setInputText(''); }}
              >
                ↩ Ответить
              </button>
            )}
            {replies.length > 0 && (
              <div className="cp-replies">
                {replies.map(r => renderComment(r, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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

      {/* Reactions Bar */}
      {currentUser?.authToken && (
        <div className="cp-reactions-bar">
          {MUSIC_REACTIONS.map(emoji => {
            const postId = activePostId!;
            const myReactions = postReactions[postId] || {};
            const counts = reactionCounts[postId] || {};
            const isActive = !!myReactions[emoji];
            const count = counts[emoji] || 0;
            return (
              <button
                key={emoji}
                className={`cp-reaction-btn${isActive ? ' is-active' : ''}`}
                onClick={() => handleReaction(emoji)}
                title={isActive ? `Убрать ${emoji}` : `${emoji}`}
              >
                {emoji} {count > 0 && <span className="cp-reaction-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="cp-list" ref={listRef}>
        {status === 'loading' && <div className="cp-loading">Загрузка…</div>}
        {status === 'error' && <div className="cp-error">Ошибка загрузки</div>}
        {status === 'ready' && topLevelComments.length === 0 && (
          <div className="cp-empty-list">
            <p>Нет комментариев</p>
            <p className="cp-empty-sub">Будьте первым!</p>
          </div>
        )}
        {topLevelComments.map(c => renderComment(c, false))}
      </div>

      {/* Input form */}
      <div className="cp-form">
        {replyTo && (
          <div className="cp-reply-indicator">
            Ответ на комментарий
            <button className="cp-reply-cancel" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        <textarea
          className="cp-input"
          placeholder={replyTo ? 'Напишите ответ…' : 'Введите комментарий…'}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          rows={2}
        />
        <button
          className="cp-send-btn"
          onClick={replyTo ? handleReplySend : handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? '…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}
