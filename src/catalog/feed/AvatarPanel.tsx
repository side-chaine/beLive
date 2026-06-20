// @TC-098-15: AvatarPanel — 3D avatar iframe + postMessage + profile + ELO

import { useEffect, useRef } from 'react';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useTrackStore } from '../../stores/track.store';
import { eloToRank } from './feed.types';

export function AvatarPanel() {
  const user = useUserProfileStore(s => s.currentUser);
  const currentTrackIndex = useTrackStore(s => s.currentTrackIndex);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mockElo = 1247;
  const rank = eloToRank(mockElo);

  // postMessage protocol: idle | sing | vibe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const state = currentTrackIndex !== null && currentTrackIndex >= 0 ? 'sing' : 'idle';
    try {
      iframe.contentWindow.postMessage({ type: 'avatar-state', state }, '*');
    } catch {
      // iframe not ready yet
    }
  }, [currentTrackIndex]);

  return (
    <div className="ap">
      <div className="ap-frame">
        <iframe
          ref={iframeRef}
          className="ap-iframe"
          sandbox="allow-scripts"
          title="Avatar"
          srcDoc={AVATAR_PLACEHOLDER_HTML}
        />
      </div>
      <div className="ap-info">
        <span className="ap-name">{user?.name || 'Гость'}</span>
        {user?.isGuest && <span className="ap-badge">Гость</span>}
      </div>
      <div className="ap-elo">
        <span className={`ap-rank ap-rank--${rank}`}>
          {rank === 'bronze' && '🥉'}
          {rank === 'silver' && '🥈'}
          {rank === 'gold' && '🥇'}
          {rank === 'platinum' && '💎'}
          {rank === 'diamond' && '👑'}
          {' '}{rank === 'bronze' ? 'Bronze' : rank === 'silver' ? 'Silver' : rank === 'gold' ? 'Gold' : rank === 'platinum' ? 'Platinum' : 'Diamond'}
        </span>
        <span className="ap-elo-val">{mockElo.toLocaleString()} ELO</span>
      </div>
      <div className="ap-stats">
        <div className="ap-stat">
          <span className="ap-val">0</span>
          <span className="ap-lbl">Постов</span>
        </div>
        <div className="ap-stat">
          <span className="ap-val">0</span>
          <span className="ap-lbl">Лайков</span>
        </div>
      </div>
    </div>
  );
}

const AVATAR_PLACEHOLDER_HTML = '<!DOCTYPE html><html><head><style>' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui}' +
'.av{font-size:48px;animation:pulse 2s ease-in-out infinite}' +
'@keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.1);opacity:1}}' +
'</style></head><body><div class="av">🎤</div>' +
'<script>' +
'window.addEventListener(\'message\',function(e){' +
'if(e.data&&e.data.type===\'avatar-state\'){' +
'document.body.dataset.state=e.data.state;' +
'var av=document.querySelector(\'.av\');' +
'if(av)av.textContent=e.data.state===\'sing\'?\'🎵\':e.data.state===\'vibe\'?\'🎶\':\'🎤\';' +
'}' +
'});' +
'</scr' + 'ipt>' +
'</body></html>';
