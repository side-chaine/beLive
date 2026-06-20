// @TC-FEED-REARCH: FeedScreen — полноэкранная соц-лента (3 колонки + presets)

import { useUIStore } from '../stores/ui.store';
import { AvatarPanel } from '../catalog/feed/AvatarPanel';
import { FeedLayout } from '../catalog/feed/FeedLayout';
import { CommentsPanel } from '../catalog/feed/CommentsPanel';
import { ColHeader } from './ColHeader';
import { EdgeTab } from './EdgeTab';
import './FeedScreen.css';

export function FeedScreen() {
  const col0Visible = useUIStore(s => s.feedCol0Visible);
  const col2Visible = useUIStore(s => s.feedCol2Visible);
  const setCol0Visible = useUIStore(s => s.setFeedCol0Visible);
  const setCol2Visible = useUIStore(s => s.setFeedCol2Visible);

  const preset = !col0Visible && !col2Visible ? 'focus'
               : !col0Visible ? 'studio-right'
               : !col2Visible ? 'studio-left'
               : 'hub';

  return (
    <div className="feed-screen">
      <div className="feed-grid" data-preset={preset}>
        {/* Col 0: Profile */}
        <div className="feed-col feed-col--0">
          <ColHeader icon="🎤" title="Профиль" collapsible isVisible={col0Visible} onToggle={() => setCol0Visible(!col0Visible)} />
          <AvatarPanel />
        </div>

        {/* Col 1: Feed — always visible */}
        <div className="feed-col feed-col--1">
          <ColHeader icon="🔥" title="Лента" collapsible={false} isVisible />
          <FeedLayout />
        </div>

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
