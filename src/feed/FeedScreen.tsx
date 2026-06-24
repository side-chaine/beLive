// @TC-102: FeedScreen — Resizable Columns + presets

import { useRef, useEffect } from 'react';
import { useUIStore } from '../stores/ui.store';
import { AvatarEngine } from '../avatar/AvatarEngine';
import { FeedLayout } from '../catalog/feed/FeedLayout';
import { CommentsPanel } from '../catalog/feed/CommentsPanel';
import { ColHeader } from './ColHeader';
import { EdgeTab } from './EdgeTab';
import { useResizeColumns } from './useResizeColumns';
import { ProfileStats } from './ProfileStats';
import { TrackCard } from './TrackCard';
import { useFeedStore } from '../catalog/feed/feed.store';
import './FeedScreen.css';

export function FeedScreen() {
  const col0Visible = useUIStore(s => s.feedCol0Visible);
  const col2Visible = useUIStore(s => s.feedCol2Visible);
  const setCol0Visible = useUIStore(s => s.setFeedCol0Visible);
  const setCol2Visible = useUIStore(s => s.setFeedCol2Visible);
  const setActivePost = useFeedStore(s => s.setActivePost);

  // Cleanup activePostId when col0 is hidden (prevents stale TrackCard)
  useEffect(() => {
    if (!col0Visible) setActivePost(null);
  }, [col0Visible, setActivePost]);

  const gridRef = useRef<HTMLDivElement>(null);
  const { displayWidths, isDragging, isMobile, onPointerDown, onDoubleClick, onKeyDown } = useResizeColumns(gridRef);

  const preset = !col0Visible && !col2Visible ? 'focus'
               : !col0Visible ? 'studio-right'
               : !col2Visible ? 'studio-left'
               : 'hub';

  return (
    <div className="feed-screen">
      <div
        ref={gridRef}
        className="feed-grid"
        data-preset={preset}
        data-dragging={isDragging || undefined}
        style={{
          '--col0-w': `${displayWidths.col0}px`,
          '--col2-w': `${displayWidths.col2}px`,
        } as React.CSSProperties}
      >
        {/* Col 0: Profile */}
        <div className="feed-col feed-col--0">
          <ColHeader icon="🎤" title="Профиль" collapsible isVisible={col0Visible} onToggle={() => setCol0Visible(!col0Visible)} />
          <div className="av-frame">
            <div className="av-frame-inner">
              <AvatarEngine mode="full" />
            </div>
          </div>
          <ProfileStats />
          <TrackCard />
        </div>

        {/* DragHandle 0 — between col0 and col1 */}
        {col0Visible && !isMobile && (
          <div
            className="drag-handle drag-handle--0"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={displayWidths.col0}
            aria-valuemin={180}
            aria-valuemax={400}
            aria-label="Resize profile column"
            tabIndex={0}
            onPointerDown={(e) => onPointerDown(e, 'col0')}
            onDoubleClick={() => onDoubleClick('col0')}
            onKeyDown={(e) => onKeyDown(e, 'col0')}
          />
        )}

        {/* Col 1: Feed — always visible */}
        <div className="feed-col feed-col--1">
          <ColHeader icon="🔥" title="Лента" collapsible={false} isVisible />
          <FeedLayout />
        </div>

        {/* DragHandle 1 — between col1 and col2 */}
        {col2Visible && !isMobile && (
          <div
            className="drag-handle drag-handle--1"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={displayWidths.col2}
            aria-valuemin={240}
            aria-valuemax={500}
            aria-label="Resize comments column"
            tabIndex={0}
            onPointerDown={(e) => onPointerDown(e, 'col2')}
            onDoubleClick={() => onDoubleClick('col2')}
            onKeyDown={(e) => onKeyDown(e, 'col2')}
          />
        )}

        {/* Col 2: Right slot */}
        <div className="feed-col feed-col--2">
          <ColHeader icon="💬" title="Комментарии" collapsible isVisible={col2Visible} onToggle={() => setCol2Visible(!col2Visible)} />
          <CommentsPanel />
        </div>
      </div>

      {/* Edge Tabs — fixed, вне grid */}
      {!col0Visible && <EdgeTab side="left" onClick={() => setCol0Visible(true)} />}
      {!col2Visible && <EdgeTab side="right" onClick={() => setCol2Visible(true)} />}
    </div>
  );
}
