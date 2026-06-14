// @TC-088: Hero Stack — Ken Burns + Fade + CF Image Resizing

import { usePerformanceTier } from '../../performance/performance.hooks';
import type { FeedItem } from './feed.types';
import { getFeedCoverUrl } from './feed.types';

interface Props {
  section: { id: string; title: string };  // section metadata
  items: FeedItem[];
}

export function HeroStack({ items }: Props) {
  const tier = usePerformanceTier();

  if (items.length === 0) return null;

  return (
    <div className="feed-hero-stack" data-tier={tier}>
      {items.slice(0, 3).map((item, i) => {
        const cover = getFeedCoverUrl(item.coverR2Key) || item.coverUrl;
        return (
          <div key={item.id} className={`feed-hero-card feed-hero-card--${i}`}>
            {cover && (
              <div
                className="feed-hero-bg"
                style={{ backgroundImage: `url(${cover})` }}
              />
            )}
            <div className="feed-hero-content">
              <h3 className="feed-hero-title">{item.title}</h3>
              {item.subtitle && <p className="feed-hero-subtitle">{item.subtitle}</p>}
              {item.description && <p className="feed-hero-desc">{item.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
