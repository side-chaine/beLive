// @TC-088: Aurora Stage Feed Layout — main wrapper

import { useEffect } from 'react';
import { useFeedStore } from './feed.store';
import { usePerformanceTier } from '../../performance/performance.hooks';
import { HeroStack } from './HeroStack';
import { EventList } from './EventList';
import { TrackScroll } from './TrackScroll';
import { FeedCover } from './FeedCover';
import './FeedLayout.css';

interface Props {
  tracks: any[];
  play: (index: number) => void;
}

export function FeedLayout({ tracks, play }: Props) {
  const { sections, items, status, fetchFeed } = useFeedStore();
  const tier = usePerformanceTier();

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (status === 'loading' && items.length === 0) {
    return <FeedCover />;
  }

  if (status === 'error' && items.length === 0) {
    return (
      <div className="feed-error">
        <p>⚠️ Не удалось загрузить ленту</p>
        <button onClick={() => fetchFeed(true)}>Повторить</button>
      </div>
    );
  }

  return (
    <div className="aurora-stage" data-tier={tier}>
      {sections.map(section => {
        const sectionItems = items.filter(i => i.sectionId === section.id);

        switch (section.type) {
          case 'hero-stack':
            return <HeroStack key={section.id} section={section} items={sectionItems} />;
          case 'list':
            return <EventList key={section.id} section={section} items={sectionItems} />;
          case 'scroll':
            return <TrackScroll key={section.id} section={section} items={sectionItems} tracks={tracks} play={play} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
