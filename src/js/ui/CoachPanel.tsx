export function CoachPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="coach-panel" role="dialog" aria-label="Coach Panel">
      <header className="coach-panel__head">
        <span>Coach</span>
        <button onClick={onClose} aria-label="close">×</button>
      </header>
      <div className="coach-panel__body">
        {/* Mac-зона: подсказки/разбор от сабагентов */}
      </div>
    </div>
  );
}
