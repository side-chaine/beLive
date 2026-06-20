// @TC-FEED-REARCH: ColHeader — мини-шапка колонки с коллапсом

interface Props {
  icon: string;
  title: string;
  collapsible: boolean;
  isVisible: boolean;
  onToggle?: () => void;
}

export function ColHeader({ icon, title, collapsible, isVisible, onToggle }: Props) {
  return (
    <div className="col-hdr">
      <span className="col-hdr-title">{icon} {title}</span>
      {collapsible && (
        <button className="col-hdr-toggle" onClick={onToggle}>
          {isVisible ? '◂' : '▸'}
        </button>
      )}
    </div>
  );
}
