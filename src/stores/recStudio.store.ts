import { create } from 'zustand';
import type {
  RecScenario, RecPoint, RecStep,
  RecStudioMode, StepType, FeatureSnapshot
} from '../types/rec-studio.types';
import { getFeature, captureSnapshot, restoreSnapshot } from '../components/RecStudio/featureRegistry';
import { useRecordingStore } from './recording.store';

// ── Helpers ──

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyScenario(): RecScenario {
  return {
    title: 'Новый сценарий',
    points: [
      {
        id: generateId(),
        title: 'Новый пункт',
        steps: [
          {
            id: generateId(),
            type: 'content' as StepType,
            title: '',
          },
        ],
      },
    ],
    updatedAt: Date.now(),
  };
}

/** Найти индексы пункта и шага по ID шага */
function findStepLocation(
  scenario: RecScenario,
  stepId: string
): { pointIndex: number; stepIndex: number } | null {
  for (let pi = 0; pi < scenario.points.length; pi++) {
    for (let si = 0; si < scenario.points[pi].steps.length; si++) {
      if (scenario.points[pi].steps[si].id === stepId) {
        return { pointIndex: pi, stepIndex: si };
      }
    }
  }
  return null;
}

// ── Store ──

interface RecStudioState {
  // ── Режим ──
  activeMode: RecStudioMode;

  // ── Сценарий (ОДИН, текущий) ──
  scenario: RecScenario;
  activePointIndex: number;
  activeStepIndex: number;

  // ── Feature state ──
  featureActive: boolean;
  activeFeatureId: string | null;
  featureSourceStepId: string | null;
  _featureSnapshot: FeatureSnapshot | null;

  // ИНВАРИАНТ: featureActive === true ⟹ activeMode === 'scenario'

  // ── Transition (заглушка для Фазы 2) ──
  featureTransition: boolean;
  featureTransitionLabel: string | null;

  // ── Scenario completion ──
  scenarioComplete: boolean;

  // ── Presentation ──
  isPresenting: boolean;
  showSlide: boolean;

  // ── Presentation ──
  startPresentation: () => void;
  stopPresentation: () => void;
  toggleSlide: () => void;
  dockPosition: { x: number; y: number };
  setDockPosition: (pos: { x: number; y: number }) => void;

  // ── Mode ──
  openScenario: () => void;
  closeScenario: () => void;

  // ── Title ──
  updateTitle: (title: string) => void;

  // ── Points ──
  addPoint: (title?: string) => void;
  removePoint: (pointId: string) => void;
  updatePoint: (pointId: string, data: Partial<RecPoint>) => void;
  movePoint: (fromIndex: number, toIndex: number) => void;

  // ── Steps ──
  addStep: (pointId: string, type?: StepType) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, data: Partial<RecStep>) => void;
  moveStep: (pointId: string, fromIndex: number, toIndex: number) => void;

  // ── Navigation ──
  nextStep: () => void;
  prevStep: () => void;
  nextPoint: () => void;
  prevPoint: () => void;

  // ── Feature ──
  activateFeature: () => void;
  deactivateFeature: () => void;

  // ── Persistence ──
  save: () => Promise<void>;
  load: () => Promise<void>;
}

export const useRecStudioStore = create<RecStudioState>()((set, get) => ({
  // ── Initial state ──
  activeMode: 'entry',
  scenario: createEmptyScenario(),
  activePointIndex: 0,
  activeStepIndex: 0,

  featureActive: false,
  activeFeatureId: null,
  featureSourceStepId: null,
  _featureSnapshot: null,

  featureTransition: false,
  featureTransitionLabel: null,

  scenarioComplete: false,

  isPresenting: false,
  showSlide: false,
  dockPosition: { x: -1, y: -1 },  // -1 = auto (default position)

  // ── Mode ──
  openScenario: () => {
    set({ activeMode: 'scenario', scenarioComplete: false });
  },

  closeScenario: () => {
    const state = get();
    // Guard 1: feature active — нельзя закрывать
    if (state.featureActive) return;
    // Guard 2: recording active — нельзя закрывать
    if (useRecordingStore.getState().isRecording) return;
    // Guard 3: presenting — сначала остановить
    if (state.isPresenting) return;
    set({ activeMode: 'entry' });
  },

  // ── Title ──
  updateTitle: (title) => {
    set(s => ({
      scenario: { ...s.scenario, title, updatedAt: Date.now() },
    }));
  },

  // ── Points ──
  addPoint: (title) => {
    const newPoint: RecPoint = {
      id: generateId(),
      title: title ?? 'Новый пункт',
      steps: [{ id: generateId(), type: 'content', title: '' }],
    };
    set(s => ({
      scenario: {
        ...s.scenario,
        points: [...s.scenario.points, newPoint],
        updatedAt: Date.now(),
      },
    }));
  },

  removePoint: (pointId) => {
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.filter(p => p.id !== pointId),
        updatedAt: Date.now(),
      },
      activePointIndex: Math.min(s.activePointIndex, Math.max(0, s.scenario.points.length - 2)),
      activeStepIndex: 0,
    }));
  },

  updatePoint: (pointId, data) => {
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.map(p =>
          p.id === pointId ? { ...p, ...data } : p
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  movePoint: (fromIndex, toIndex) => {
    set(s => {
      const points = [...s.scenario.points];
      const [moved] = points.splice(fromIndex, 1);
      points.splice(toIndex, 0, moved);
      return { scenario: { ...s.scenario, points, updatedAt: Date.now() } };
    });
  },

  // ── Steps ──
  addStep: (pointId, type) => {
    const newStep: RecStep = {
      id: generateId(),
      type: type ?? 'content',
      title: '',
    };
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.map(p =>
          p.id === pointId
            ? { ...p, steps: [...p.steps, newStep] }
            : p
        ),
        updatedAt: Date.now(),
      },
    }));
  },

  removeStep: (stepId) => {
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.map(p => ({
          ...p,
          steps: p.steps.filter(st => st.id !== stepId),
        })).filter(p => p.steps.length > 0), // Удалить пустые пункты
        updatedAt: Date.now(),
      },
      activeStepIndex: Math.max(0, s.activeStepIndex - 1),
    }));
  },

  updateStep: (stepId, data) => {
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.map(p => ({
          ...p,
          steps: p.steps.map(st =>
            st.id === stepId ? { ...st, ...data } : st
          ),
        })),
        updatedAt: Date.now(),
      },
    }));
  },

  moveStep: (pointId, fromIndex, toIndex) => {
    set(s => ({
      scenario: {
        ...s.scenario,
        points: s.scenario.points.map(p => {
          if (p.id !== pointId) return p;
          const steps = [...p.steps];
          const [moved] = steps.splice(fromIndex, 1);
          steps.splice(toIndex, 0, moved);
          return { ...p, steps };
        }),
        updatedAt: Date.now(),
      },
    }));
  },

  // ── Navigation ──
  nextStep: () => {
    const { scenario, activePointIndex, activeStepIndex } = get();
    const point = scenario.points[activePointIndex];
    if (!point) return;

    if (activeStepIndex < point.steps.length - 1) {
      set({ activeStepIndex: activeStepIndex + 1, scenarioComplete: false });
    } else if (activePointIndex < scenario.points.length - 1) {
      set({ activePointIndex: activePointIndex + 1, activeStepIndex: 0, scenarioComplete: false });
    } else {
      // Конец сценария
      set({ scenarioComplete: true });
    }
  },

  prevStep: () => {
    const { scenario, activePointIndex, activeStepIndex } = get();
    if (activeStepIndex > 0) {
      set({ activeStepIndex: activeStepIndex - 1, scenarioComplete: false });
    } else if (activePointIndex > 0) {
      const prevPoint = scenario.points[activePointIndex - 1];
      set({
        activePointIndex: activePointIndex - 1,
        activeStepIndex: prevPoint ? prevPoint.steps.length - 1 : 0,
        scenarioComplete: false,
      });
    }
  },

  nextPoint: () => {
    const { scenario, activePointIndex } = get();
    if (activePointIndex < scenario.points.length - 1) {
      set({ activePointIndex: activePointIndex + 1, activeStepIndex: 0, scenarioComplete: false });
    }
  },

  prevPoint: () => {
    const { activePointIndex } = get();
    if (activePointIndex > 0) {
      set({ activePointIndex: activePointIndex - 1, activeStepIndex: 0, scenarioComplete: false });
    }
  },

  // ── Feature ──
  activateFeature: () => {
    const state = get();
    // Guard: только из scenario
    if (state.activeMode !== 'scenario') return;
    // Guard: уже в feature
    if (state.featureActive) return;

    const point = state.scenario.points[state.activePointIndex];
    const step = point?.steps[state.activeStepIndex];
    if (!step || step.type !== 'feature' || !step.action) return;

    const feature = getFeature(step.action.type);
    if (!feature) return;

    // Capture snapshot ДО execute — реальные данные из deck.store
    const snapshot = captureSnapshot();

    try {
      feature.execute(step.action.preset);
      set({
        featureActive: true,
        activeFeatureId: feature.id,
        featureSourceStepId: step.id,
        _featureSnapshot: snapshot,
      });
    } catch (e) {
      console.error('[RecStudio] Feature execute failed:', e);
      // Store НЕ меняется — инвариант сохраняется
    }
  },

  deactivateFeature: () => {
    const { activeFeatureId, featureSourceStepId, scenario, _featureSnapshot } = get();

    const feature = activeFeatureId ? getFeature(activeFeatureId) : null;
    if (feature) {
      try {
        feature.deactivate();
      } catch (e) {
        console.error('[RecStudio] Feature deactivate failed:', e);
      }
    }

    // Восстановить состояние deck из snapshot
    if (_featureSnapshot) {
      restoreSnapshot(_featureSnapshot);
    }

    // Восстановить навигацию на source step
    if (featureSourceStepId) {
      const loc = findStepLocation(scenario, featureSourceStepId);
      if (loc) {
        set({ activePointIndex: loc.pointIndex, activeStepIndex: loc.stepIndex });
      }
    }

    set({
      featureActive: false,
      activeFeatureId: null,
      featureSourceStepId: null,
      _featureSnapshot: null,
    });

    // Auto: перейти к следующему шагу
    get().nextStep();
  },

  // ── Presentation ──
  startPresentation: () => {
    const state = get();
    if (state.activeMode !== 'scenario') return;
    if (state.featureActive) return;
    if (state.isPresenting) return;

    // Load saved dock position
    let dockPos = { x: -1, y: -1 };
    try {
      const saved = localStorage.getItem('rec_studio_dock_pos_v1');
      if (saved) dockPos = JSON.parse(saved);
    } catch {}

    set({ isPresenting: true, showSlide: false, scenarioComplete: false, dockPosition: dockPos });
  },

  stopPresentation: () => {
    const state = get();
    if (!state.isPresenting) return;
    set({ isPresenting: false, showSlide: false, scenarioComplete: false });
  },

  toggleSlide: () => {
    const state = get();
    if (!state.isPresenting) return;
    set({ showSlide: !state.showSlide });
  },

  setDockPosition: (pos) => {
    set({ dockPosition: pos });
    // Persist
    try { localStorage.setItem('rec_studio_dock_pos_v1', JSON.stringify(pos)); } catch {}
  },

  // ── Persistence ──
  save: async () => {
    const { scenario } = get();
    try {
      const { saveRecScenario } = await import('../services/idb.service');
      await saveRecScenario(scenario);
    } catch (e) {
      console.error('[RecStudio] Save failed:', e);
    }
  },

  load: async () => {
    try {
      const { loadRecScenario } = await import('../services/idb.service');
      const scenario = await loadRecScenario();
      if (scenario) {
        set({ scenario, activePointIndex: 0, activeStepIndex: 0 });
      }
    } catch (e) {
      console.error('[RecStudio] Load failed:', e);
    }
  },
}));

// ── Auto-save ──

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    useRecStudioStore.getState().save();
  }, 2000);
}

useRecStudioStore.subscribe((state, prevState) => {
  if (state.scenario !== prevState.scenario) {
    scheduleAutoSave();
  }
});
