import { useRecStudioStore } from '../../stores/recStudio.store';
import styles from './RecStudioEntry.module.css';

export function RecStudioEntry() {
  const openScenario = useRecStudioStore(s => s.openScenario);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <svg className={styles.icon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      
      <h2 className={styles.title}>Сценарий презентации</h2>
      <p className={styles.description}>
        Подготовь рассказ, затем запиши
      </p>
      
      <button className={styles.startButton} onClick={openScenario}>
        Начать сценарий
      </button>
    </div>
  );
}
