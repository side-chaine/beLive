// @TC-088: Event List — Convex Glass cards + CF Image Resizing

import { usePerformanceTier } from '../../performance/performance.hooks';
import type { FeedSection, FeedItem } from './feed.types';
import { getFeedCoverUrl } from './feed.types';

interface Props {
  section: FeedSection;
  items: FeedItem[];
}

export function EventList({ section, items }: Props) {
  const tier = usePerformanceTier();

  if (items.length === 0) return null;

  return (
    <div className="feed-event-list" data-tier={tier}>
      <h4 className="feed-section-title">{section.title}</h4>
      <div className="feed-event-grid">
        {items.map(item => {
          const cover = getFeedCoverUrl(item.coverR2Key) || item.coverUrl;
          return (
            <div key={item.id} className="feed-event-card">
              <div className="feed-event-glass" />
              {cover && (
                <div className="feed-event-cover"
                  style={{ backgroundImage: `url(${cover})` }}
                />
              )}
              <div className="feed-event-body">
                <h5 className="feed-event-title">{item.title}</h5>
                {item.subtitle && <span className="feed-event-subtitle">{item.subtitle}</span>}
                {item.description && <p className="feed-event-desc">{item.description}</p>}
                {'price' in item && item.price && (
                  <span className="feed-event-price">{item.price}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
