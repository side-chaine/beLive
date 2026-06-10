import { describe, it, expect } from 'vitest';

// Импортируем чистые функции из show.store
// Они не экспортированы, поэтому тестируем через store actions
import { useShowStore } from '../show.store';

describe('show.store — чистые функции', () => {
  it('createEmptyScenario создаёт сценарий с одним пунктом и шагом', () => {
    // Проверяем через openScenario
    useShowStore.getState().openScenario();
    const s = useShowStore.getState();
    expect(s.scenario.title).toBe('Новый сценарий');
    expect(s.scenario.points.length).toBe(1);
    expect(s.scenario.points[0].steps.length).toBe(1);
    expect(s.activeMode).toBe('scenario');
  });

  it('closeScenario сбрасывает режим', () => {
    useShowStore.getState().openScenario();
    useShowStore.getState().closeScenario();
    expect(useShowStore.getState().activeMode).toBe('entry');
  });

  it('updateTitle меняет название сценария', () => {
    useShowStore.getState().openScenario();
    useShowStore.getState().updateTitle('Мой шоу');
    expect(useShowStore.getState().scenario.title).toBe('Мой шоу');
  });

  it('добавление и удаление пункта', () => {
    useShowStore.getState().openScenario();
    const pointId = useShowStore.getState().scenario.points[0].id;
    
    useShowStore.getState().addPoint('Новый пункт');
    expect(useShowStore.getState().scenario.points.length).toBe(2);
    
    useShowStore.getState().removePoint(pointId);
    expect(useShowStore.getState().scenario.points.length).toBe(1);
  });

  it('навигация по шагам', () => {
    useShowStore.getState().openScenario();
    const point = useShowStore.getState().scenario.points[0];
    
    // Добавляем второй шаг
    useShowStore.getState().addStep(point.id, 'feature');
    
    useShowStore.getState().nextStep();
    expect(useShowStore.getState().activeStepIndex).toBe(1);
    
    useShowStore.getState().prevStep();
    expect(useShowStore.getState().activeStepIndex).toBe(0);
  });
});
