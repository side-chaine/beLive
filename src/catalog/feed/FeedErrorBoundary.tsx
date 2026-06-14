// @TC-088: Clone of TrackInfoErrorBoundary for Aurora Stage feed

import React from 'react';

export class FeedErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bl-text-muted)' }}>
          ⚠️ Лента временно недоступна
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              display: 'block', margin: '12px auto',
              color: 'var(--bl-accent)', background: 'none',
              border: 'none', cursor: 'pointer',
            }}
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
