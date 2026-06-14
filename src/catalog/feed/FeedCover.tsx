// @TC-088: Feed Cover — Shimmer skeleton during loading

export function FeedCover() {
  return (
    <div className="feed-cover">
      {[1, 2, 3].map(i => (
        <div key={i} className="feed-cover-card">
          <div className="feed-cover-shimmer feed-cover-image" />
          <div className="feed-cover-shimmer feed-cover-line feed-cover-line--short" />
          <div className="feed-cover-shimmer feed-cover-line" />
        </div>
      ))}
    </div>
  );
}
