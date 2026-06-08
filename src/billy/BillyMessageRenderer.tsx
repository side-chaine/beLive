import React, { useCallback } from 'react';
import './BillyMessageRenderer.css';

interface BillyMessageRendererProps {
  content: string;
  onAction?: (action: string) => void;
}

export function BillyMessageRenderer({ content, onAction }: BillyMessageRendererProps) {
  const renderContent = useCallback((text: string) => {
    const parts: React.JSX.Element[] = [];
    let key = 0;
    let remaining = text;

    while (remaining.length > 0) {
      const btnMatch = remaining.match(/\[кнопка:\s*(.+?)\s*\|\s*(.+?)\]/);
      const linkMatch = remaining.match(/\[ссылка:\s*(.+?)\s*\|\s*(.+?)\]/);
      const highlightMatch = remaining.match(/\[highlight-zip\]/);

      const positions = [
        btnMatch ? btnMatch.index! : Infinity,
        linkMatch ? linkMatch.index! : Infinity,
        highlightMatch ? highlightMatch.index! : Infinity,
      ].filter(p => p !== Infinity);

      if (positions.length === 0) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }

      const firstPos = Math.min(...positions);

      if (firstPos > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, firstPos)}</span>);
      }

      if (btnMatch && btnMatch.index === firstPos) {
        const [, label, action] = btnMatch;
        parts.push(
          <button
            key={key++}
            className="bl-billy-action-btn"
            onClick={() => onAction?.(action.trim())}
          >
            {label.trim()}
          </button>
        );
        remaining = remaining.slice(firstPos + btnMatch[0].length);
      } else if (linkMatch && linkMatch.index === firstPos) {
        const [, label, url] = linkMatch;
        parts.push(
          <a
            key={key++}
            className="bl-billy-link"
            href={url.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label.trim()}
          </a>
        );
        remaining = remaining.slice(firstPos + linkMatch[0].length);
      } else if (highlightMatch && highlightMatch.index === firstPos) {
        parts.push(
          <button
            key={key++}
            className="bl-billy-action-btn bl-billy-action-btn--highlight"
            onClick={() => onAction?.('highlight-zip')}
          >
            📂 Подсветить куда кидать
          </button>
        );
        remaining = remaining.slice(firstPos + highlightMatch[0].length);
      }
    }

    return parts;
  }, [onAction]);

  return <div className="bl-billy-message">{renderContent(content)}</div>;
}
