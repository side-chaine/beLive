import { create } from 'zustand';
import type {
  ShowScenario, ShowPoint, ShowStep,
  ShowMode, StepType, FeatureSnapshot,
  ShowSubSlide
} from '../types/show.types';
import { getFeature, captureSnapshot, restoreSnapshot } from '../components/Show/featureRegistry';
import { useRecordingStore } from './recording.store';

// ── Helpers ──

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyScenario(): ShowScenario {
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
            subSlides: [{}],
          },
        ],
      },
    ],
    updatedAt: Date.now(),
  };
}

/** Найти индексы пункта и шага по ID шага */
function findStepLocation(
  scenario: ShowScenario,
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

/** Ленивая миграция: legacy content-шаг → subSlides */
function migrateStepToSubSlides(step: ShowStep): ShowStep {
  // Идемпотентность: undefined = не мигрирован, [] = мигрирован (пустой шаг)
  if (step.subSlides !== undefined) return step;
  // Только content-шаги
  if (step.type !== 'content') return step;

  const subSlides: ShowSubSlide[] = [];

  if (step.imageIds?.length) {
    // Есть фото — каждое фото = отдельный суб-слайд
    step.imageIds.forEach((imageId, idx) => {
      const caption = step.imageCaptions?.[idx] || '';
      subSlides.push({
        imageId,
        title: idx === 0 ? step.title : undefined,
        // subSlides[0]: step.description приоритетнее caption
        // subSlides[1+]: caption → description
        description: idx === 0
          ? (step.description || caption || undefined)
          : (caption || undefined),
        bullets: idx === 0 ? step.bullets?.map(text => ({ text })) : undefined,
      });
    });
  } else if (step.description || step.bullets?.length) {
    // Нет фото, есть текст — один текстовый суб-слайд
    subSlides.push({
      title: step.title,
      description: step.description,
      bullets: step.bullets?.map(text => ({ text })),
    });
  } else if (step.title) {
    // Только заголовок — один суб-слайд с заголовком
    subSlides.push({
      title: step.title,
    });
  }
  // Пустой шаг → subSlides=[] (маркер "мигрирован, но пуст")

  return { ...step, subSlides };
}

/** Мигрировать все content-шаги в сценарии */
function migrateScenarioSteps(scenario: ShowScenario): {
  scenario: ShowScenario;
  migrated: boolean;
} {
  let migrated = false;
  const points = scenario.points.map(point => {
    const steps = point.steps.map(step => {
      const migratedStep = migrateStepToSubSlides(step);
      if (migratedStep !== step) migrated = true;
      return migratedStep;
    });
    return { ...point, steps };
  });
  return { scenario: { ...scenario, points }, migrated };
}

// ── Store ──

interface ShowState {
  // ── Режим ──
  activeMode: ShowMode;

  // ── Сценарий (ОДИН, текущий) ──
  scenario: ShowScenario;
  activePointIndex: number;
  activeStepIndex: number;
  // ── Sub-slide navigation (НОВОЕ) ──
  activeSubSlideIndex: number;
  activeBulletIndex: number;  // -1 = нет активного пункта

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
  updatePoint: (pointId: string, data: Partial<ShowPoint>) => void;
  movePoint: (fromIndex: number, toIndex: number) => void;

  // ── Steps ──
  addStep: (pointId: string, type?: StepType) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, data: Partial<ShowStep>) => void;
  moveStep: (pointId: string, fromIndex: number, toIndex: number) => void;

  // ── Navigation ──
  nextStep: () => void;
  prevStep: () => void;
  nextPoint: () => void;
  prevPoint: () => void;
  // ── Sub-slide screen navigation (НОВОЕ) ──
  nextScreen: () => void;
  prevScreen: () => void;
  getCurrentScreenInfo: () => ScreenInfo;

  // ── Feature ──
  activateFeature: () => void;
  deactivateFeature: () => void;

  // ── Persistence ──
  save: () => Promise<void>;
  load: () => Promise<void>;
}

// ── Screen info types ──

export type ScreenInfo =
  | {
      type: 'subslide';
      subSlideIndex: number;
      totalSubSlides: number;
      bulletIndex: number;
      totalBullets: number;
      isFirst: boolean;
      isLast: boolean;
      screenNumber: number;
      totalScreens: number;
      stepIndex: number;
      totalSteps: number;
      pointIndex: number;
      totalPoints: number;
    }
  | {
      type: 'legacy';
      stepIndex: number;
      totalSteps: number;
      pointIndex: number;
      totalPoints: number;
    };

export const useShowEditorStore = create<ShowState>()((set, get) => ({
  // ── Initial state ──
  activeMode: 'entry',
  scenario: createEmptyScenario(),
  activePointIndex: 0,
  activeStepIndex: 0,
  activeSubSlideIndex: 0,
  activeBulletIndex: -1,

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
    const newPoint: ShowPoint = {
      id: generateId(),
      title: title ?? 'Новый пункт',
      steps: [{ id: generateId(), type: 'content', title: '', subSlides: [{}] }],
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
      activeSubSlideIndex: 0,
      activeBulletIndex: -1,
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
    const newStep: ShowStep = {
      id: generateId(),
      type: type ?? 'content',
      title: '',
    };
    // Content-шаги создаются с одним пустым суб-слайдом
    if ((type ?? 'content') === 'content') {
      newStep.subSlides = [{}];
    }
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
        })).filter(p => p.steps.length > 0),
        updatedAt: Date.now(),
      },
      activeStepIndex: Math.max(0, s.activeStepIndex - 1),
      activeSubSlideIndex: 0,
      activeBulletIndex: -1,
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
      set({
        activeStepIndex: activeStepIndex + 1,
        activeSubSlideIndex: 0,
        activeBulletIndex: -1,
        scenarioComplete: false,
      });
    } else if (activePointIndex < scenario.points.length - 1) {
      set({
        activePointIndex: activePointIndex + 1,
        activeStepIndex: 0,
        activeSubSlideIndex: 0,
        activeBulletIndex: -1,
        scenarioComplete: false,
      });
    } else {
      set({ scenarioComplete: true });
    }
  },

  prevStep: () => {
    const { scenario, activePointIndex, activeStepIndex } = get();
    let newPointIdx = activePointIndex;
    let newStepIdx = activeStepIndex;

    if (activeStepIndex > 0) {
      newStepIdx = activeStepIndex - 1;
    } else if (activePointIndex > 0) {
      newPointIdx = activePointIndex - 1;
      const prevPoint = scenario.points[newPointIdx];
      newStepIdx = prevPoint ? prevPoint.steps.length - 1 : 0;
    } else {
      return;
    }

    const newStep = scenario.points[newPointIdx]?.steps[newStepIdx];
    if (newStep?.subSlides?.length) {
      const lastSubSlide = newStep.subSlides[newStep.subSlides.length - 1];
      set({
        activePointIndex: newPointIdx,
        activeStepIndex: newStepIdx,
        activeSubSlideIndex: newStep.subSlides.length - 1,
        activeBulletIndex: lastSubSlide.bullets?.length
          ? lastSubSlide.bullets.length - 1
          : -1,
        scenarioComplete: false,
      });
    } else {
      set({
        activePointIndex: newPointIdx,
        activeStepIndex: newStepIdx,
        activeSubSlideIndex: 0,
        activeBulletIndex: -1,
        scenarioComplete: false,
      });
    }
  },

  nextPoint: () => {
    const { scenario, activePointIndex } = get();
    if (activePointIndex < scenario.points.length - 1) {
      set({
        activePointIndex: activePointIndex + 1,
        activeStepIndex: 0,
        activeSubSlideIndex: 0,
        activeBulletIndex: -1,
        scenarioComplete: false,
      });
    }
  },

  prevPoint: () => {
    const { activePointIndex } = get();
    if (activePointIndex > 0) {
      set({
        activePointIndex: activePointIndex - 1,
        activeStepIndex: 0,
        activeSubSlideIndex: 0,
        activeBulletIndex: -1,
        scenarioComplete: false,
      });
    }
  },

  // ── Sub-slide screen navigation ──

  nextScreen: () => {
    const s = get();
    const step = s.scenario.points[s.activePointIndex]?.steps[s.activeStepIndex];

    // Feature/HTML → legacy
    if (!step || step.type !== 'content' || !step.subSlides?.length) {
      s.nextStep();
      return;
    }

    const { activeSubSlideIndex: si, activeBulletIndex: bi } = s;
    const slide = step.subSlides[si];
    const bulletCount = slide?.bullets?.length ?? 0;

    if (bi === -1 && bulletCount > 0) {
      // Показать первый bullet
      set({ activeBulletIndex: 0 });
    } else if (bi >= 0 && bi < bulletCount - 1) {
      // Следующий bullet
      set({ activeBulletIndex: bi + 1 });
    } else if (si < step.subSlides.length - 1) {
      // Следующий суб-слайд (bullets кончились или их нет)
      set({ activeSubSlideIndex: si + 1, activeBulletIndex: -1 });
    } else {
      // Последний экран шага → следующий шаг
      s.nextStep();
    }
  },

  prevScreen: () => {
    const s = get();
    const step = s.scenario.points[s.activePointIndex]?.steps[s.activeStepIndex];

    // Feature/HTML → legacy
    if (!step || step.type !== 'content' || !step.subSlides?.length) {
      s.prevStep();
      return;
    }

    const { activeSubSlideIndex: si, activeBulletIndex: bi } = s;

    if (bi > 0) {
      // Предыдущий bullet
      set({ activeBulletIndex: bi - 1 });
    } else if (bi === 0) {
      // Вернуться к заголовку (без подсветки bullets)
      set({ activeBulletIndex: -1 });
    } else if (si > 0) {
      // Предыдущий суб-слайд → последний bullet (или -1 если нет bullets)
      const prevSlide = step.subSlides[si - 1];
      const lastBullet = prevSlide?.bullets?.length
        ? prevSlide.bullets.length - 1
        : -1;
      set({ activeSubSlideIndex: si - 1, activeBulletIndex: lastBullet });
    } else {
      // Первый экран шага → предыдущий шаг
      s.prevStep();
    }
  },

  getCurrentScreenInfo: () => {
    const { scenario, activePointIndex, activeStepIndex,
            activeSubSlideIndex, activeBulletIndex } = get();

    const point = scenario.points[activePointIndex];
    const step = point?.steps[activeStepIndex];

    // Feature/HTML или нет суб-слайдов → legacy
    if (!step || step.type !== 'content' || !step.subSlides?.length) {
      return {
        type: 'legacy' as const,
        stepIndex: activeStepIndex,
        totalSteps: point?.steps.length ?? 0,
        pointIndex: activePointIndex,
        totalPoints: scenario.points.length,
      };
    }

    // Content с суб-слайдами
    const subSlide = step.subSlides[activeSubSlideIndex];
    const bullets = subSlide?.bullets ?? [];

    // Абсолютный номер экрана внутри шага (для progress)
    let screenNumber = 0;
    for (let i = 0; i < activeSubSlideIndex; i++) {
      screenNumber += Math.max(1, step.subSlides[i].bullets?.length ?? 0);
    }
    screenNumber += activeBulletIndex + 1; // bullet=-1 → 0, bullet=0 → 1

    const totalScreens = step.subSlides.reduce(
      (acc, ss) => acc + Math.max(1, ss.bullets?.length ?? 0), 0
    );

    return {
      type: 'subslide' as const,
      subSlideIndex: activeSubSlideIndex,
      totalSubSlides: step.subSlides.length,
      bulletIndex: activeBulletIndex,
      totalBullets: bullets.length,
      isFirst: activeSubSlideIndex === 0 && activeBulletIndex <= 0,
      isLast: activeSubSlideIndex === step.subSlides.length - 1
        && activeBulletIndex >= bullets.length - 1,
      screenNumber,
      totalScreens,
      stepIndex: activeStepIndex,
      totalSteps: point.steps.length,
      pointIndex: activePointIndex,
      totalPoints: scenario.points.length,
    };
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
      console.error('[Show] Feature execute failed:', e);
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
        console.error('[Show] Feature deactivate failed:', e);
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
        set({
          activePointIndex: loc.pointIndex,
          activeStepIndex: loc.stepIndex,
          activeSubSlideIndex: 0,
          activeBulletIndex: -1,
        });
      }
    }

    set({
      featureActive: false,
      activeFeatureId: null,
      featureSourceStepId: null,
      _featureSnapshot: null,
      activeSubSlideIndex: 0,
      activeBulletIndex: -1,
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

    set({
      isPresenting: true,
      showSlide: false,
      scenarioComplete: false,
      dockPosition: dockPos,
      activeSubSlideIndex: 0,
      activeBulletIndex: -1,
    });
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
      const { saveShowScenario } = await import('../services/idb.service');
      await saveShowScenario(scenario);
    } catch (e) {
      console.error('[Show] Save failed:', e);
    }
  },

  load: async () => {
    try {
      const { loadShowScenario } = await import('../services/idb.service');
      const scenario = await loadShowScenario();
      if (scenario) {
        const { scenario: migrated, migrated: wasMigrated } = migrateScenarioSteps(scenario);
        set({
          scenario: migrated,
          activePointIndex: 0,
          activeStepIndex: 0,
          activeSubSlideIndex: 0,
          activeBulletIndex: -1,
        });
        if (wasMigrated) {
          const { saveShowScenario } = await import('../services/idb.service');
          await saveShowScenario(migrated);
        }
      }
    } catch (e) {
      console.error('[Show] Load failed:', e);
    }
  },
}));

// ── Auto-save ──

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    useShowEditorStore.getState().save();
  }, 2000);
}

useShowEditorStore.subscribe((state, prevState) => {
  if (state.scenario !== prevState.scenario) {
    scheduleAutoSave();
  }
});
