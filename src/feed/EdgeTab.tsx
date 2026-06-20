// @TC-FEED-REARCH: EdgeTab — компактная вкладка свёрнутой колонки (только стрелка)

interface Props {
  side: 'left' | 'right';
  onClick: () => void;
}

export function EdgeTab({ side, onClick }: Props) {
  return (
    <button className={`edge-tab edge-tab--${side}`} onClick={onClick} />
  );
}
