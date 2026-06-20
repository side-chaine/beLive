// @TC-098-04: CommentsPanel — stub (Wave 2: real chat)

import { useFeedStore } from './feed.store';

interface Props {
  onClose?: () => void;
}

export function CommentsPanel({ onClose }: Props) {
  const activePostId = useFeedStore(s => s.activePostId);
  const posts = useFeedStore(s => s.posts);
  const setActivePost = useFeedStore(s => s.setActivePost);
  const post = posts.find(p => p.id === activePostId);

  const handleClose = () => {
    setActivePost(null);
    onClose?.();
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
      <div className="cp-body">
        <div className="cp-stub">
          <p>💬 {post.commentsCount} комментариев</p>
          <p className="cp-stub-sub">Чат скоро появится!</p>
        </div>
      </div>
    </div>
  );
}
