// @TC-088: Track Scroll — CSS Scroll Snap + Vinyl + Optimistic UI

import { useState } from 'react';
import { usePerformanceTier } from '../../performance/performance.hooks';
import type { FeedSection, FeedItem } from './feed.types';

interface Props {
  section: FeedSection;
  items: FeedItem[];
  tracks: any[];
  play: (index: number) => void;
}

export function TrackScroll({ section, items, tracks, play }: Props) {
  const tier = usePerformanceTier();
  const [optimisticPlayingId, setOptimisticPlayingId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const handleClick = (item: FeedItem, trackIndex?: number) => {
    if (trackIndex === undefined) return;
    // Optimistic UI: vinyl spins NOW
    setOptimisticPlayingId(item.id);
    play(trackIndex);
    // Note: catch() rollback would be here but loadTrack doesn't return a Promise
    // The vinyl will stop when component re-renders with new currentTrackIndex
  };

  return (
    <div className="feed-track-scroll" data-tier={tier}>
      <h4 className="feed-section-title">{section.title}</h4>
      <div className="feed-track-snap">
        {items.map(item => {
          const trackId = 'localTrackId' in item ? item.localTrackId : undefined;
          const track = trackId ? tracks.find(t => String(t.id) === trackId) : undefined;
          const isPlaying = optimisticPlayingId === item.id;

          return (
            <div
              key={item.id}
              className={`feed-track-card${isPlaying ? ' is-playing' : ''}`}
              onClick={() => handleClick(item, track?.index)}
            >
              <div className="feed-track-vinyl">
                <div className="feed-track-cover">
                  {track?.coverArtUrl && (
                    <img src={track.coverArtUrl} alt={item.title} />
                  )}
                </div>
                <div className="feed-track-disc" />
              </div>
              <div className="feed-track-info">
                <span className="feed-track-title">{item.title}</span>
                {item.subtitle && (
                  <span className="feed-track-artist">{item.subtitle}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
