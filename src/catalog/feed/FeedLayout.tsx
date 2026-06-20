// @TC-098-05: Feed Layout — pure, no external props

import { useEffect } from 'react';
import { useFeedStore } from './feed.store';
import { usePerformanceTier } from '../../performance/performance.hooks';
import { FeedPostCard } from './FeedPostCard';
import { PostComposer } from './PostComposer';
import { FeedCover } from './FeedCover';
import './FeedLayout.css';

export function FeedLayout() {
  const { posts, status, fetchFeed } = useFeedStore();
  const tier = usePerformanceTier();

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (status === 'loading' && posts.length === 0) {
    return <FeedCover />;
  }

  if (status === 'error' && posts.length === 0) {
    return (
      <div className="feed-error">
        <p>⚠️ Не удалось загрузить ленту</p>
        <button onClick={fetchFeed}>Повторить</button>
      </div>
    );
  }

  return (
    <div className="aurora-stage" data-tier={tier}>
      <PostComposer />
      {posts.map(post => (
        <FeedPostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
