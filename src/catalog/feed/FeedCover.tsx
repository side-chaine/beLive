// @TC-098-04: Feed Cover — Shimmer skeleton for new card design

export function FeedCover() {
  return (
    <div className="feed-cover">
      {[1, 2, 3].map(i => (
        <div key={i} className="feed-cover-card">
          <div className="feed-cover-row">
            <div className="feed-cover-shimmer feed-cover-avatar" />
            <div className="feed-cover-lines">
              <div className="feed-cover-shimmer feed-cover-ln feed-cover-ln--short" />
              <div className="feed-cover-shimmer feed-cover-ln feed-cover-ln--tiny" />
            </div>
          </div>
          <div className="feed-cover-shimmer feed-cover-ln" />
          <div className="feed-cover-shimmer feed-cover-ln feed-cover-ln--med" />
        </div>
      ))}
    </div>
  );
}
