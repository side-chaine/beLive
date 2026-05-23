import { AiExpertPanel } from '../components/TrackInfoBoard/AiExpertPanel';

/**
 * Billy Chat Module — dock-embedded version of AI Expert Panel.
 * Renders compact AiExpertPanel inside ControlDeck panel.
 */
export function BillyChatModule() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 8px',
    }}>
      <AiExpertPanel compact />
    </div>
  );
}
