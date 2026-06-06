export function LoadingSplash() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bl-bg, #0a0a0a)',
      zIndex: 9999999,
    }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', marginBottom: '2rem' }}>
        beLive
      </div>
      <div className="bl-loading-dots">
        <span /><span /><span />
      </div>
      <style>{`
        .bl-loading-dots span {
          display: inline-block; width: 8px; height: 8px;
          border-radius: 50%; background: rgba(255,255,255,0.5);
          margin: 0 4px; animation: bl-dot-bounce 1.2s infinite;
        }
        .bl-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .bl-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bl-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
