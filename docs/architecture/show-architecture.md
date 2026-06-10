# 📄 SHOW — Архитектурный документ beLive

**Версия:** 2.2  
**Дата:** 2026-06-03  
**Статус:** ✅ MVP реализован  
**Based on:** Sub-Slide model  
**Архитекторы:** Центр_30.1, Центр_31, Центр_31.1, 007_32

---

# §1. Что такое Show

**Show — контентный модуль beLive для подготовки и проведения сценариев.**

Show превращает beLive из вокальной студии в инструмент для создания контента: обзоров, уроков, девлогов, демонстраций функций, мини-шоу, сторис.

Show — это не PowerPoint. Это Story Engine внутри beLive.

**Формула:**
```
Сценарий → Пункт → Шаг → Стрелка → Фрагмент
                                        ├─ Контент (текст, фото, тезисы)
                                        └─ Функция (выход в beLive + предустановка)
```

# §1.1 Продуктовая философия

beLive создавался как инструмент для репетиций.

Show расширяет beLive в сторону контента.

Главный принцип Show:

**beLive остаётся главным героем.**  
**Show никогда не заменяет beLive.**  
**Show помогает рассказать историю о том, что происходит внутри beLive.**

Слайды поддерживают рассказ.  
Функции поддерживают демонстрацию.  
Контент рождается вокруг реального взаимодействия с beLive.

Архитектурный принцип:

**beLive First. Show Second.**

Именно этот принцип привёл к архитектурной инверсии (TC-10): PresenterDock поверх beLive, а не beLive внутри Show.

---

# §2. Почему Show, а не Record Studio

Модуль начинался как **Rec Studio**. В процессе развития название перестало отражать суть.

| Критерий | Record Studio | Show |
|----------|---------------|------|
| Ассоциация | Техническая запись | Создание контента |
| Масштаб | Узкий (запись экрана) | Широкий (сценарии, демонстрации, шоу) |
| Конфликт | Studio = музыкальный модуль beLive | Show ≠ Studio, нет конфликта |
| Продуктность | Утилита | Модуль |

**Studio — для музыки и звука.**  
**Show — для истории, показа и записи контента.**

Это разделение окончательное.

---

# §3. Терминология

| Термин | Значение |
|--------|----------|
| **Show** | Основной модуль |
| **Scenario** | Сценарий показа/записи |
| **Point** | Тема/пункт сценария (в UX может отображаться как «Сцена») |
| **Step** | Шаг сценария |
| **Content Step** | Шаг с текстом, фото, тезисами |
| **Feature Step** | Шаг, открывающий функцию beLive |
| **ShowEditor** | Полноэкранный редактор сценария |
| **PresenterDock** | Компактная панель поверх beLive во время записи |
| **SlideOverlay** | Полноэкранный показ текущего шага |
| **Presentation Runtime** | Режим показа/записи |
| **Scenario Editor** | Режим подготовки сценария |
| **Feature Registry** | Реестр функций beLive, доступных из Show |

Слово «презентация» используется только для визуального способа отображения сценария (Presentation Runtime), а не как суть модуля.

---

# §4. Два режима работы

| Режим | Что делает | UI |
|-------|-----------|-----|
| **Scenario Editor** | Подготовка истории, прописывание шагов | ShowEditor: PointList + StepWorkspace + StepStrip |
| **Presentation Runtime** | Запись по стрелкам, переключение между beLive и слайдом | PresenterDock + SlideOverlay поверх beLive |

**Архитектурная инверсия (TC-10):** beLive — главный экран. Show — помощник поверх. Когда Show свёрнут — beLive владеет экраном. Когда раскрыт слайд — Show владеет экраном.

---

# §5. Модель данных

```typescript
export type ShowMode = 'entry' | 'scenario';
export type StepType = 'content' | 'feature' | 'html';

export interface ShowScenario {
  title: string;
  points: ShowPoint[];
  updatedAt: number;
}

export interface ShowPoint {
  id: string;
  title: string;
  steps: ShowStep[];
}

export interface ShowStep {
  id: string;
  type: StepType;
  // Content
  title?: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  imageIds?: string[];
  background?: string;
  notes?: string;
  // Feature
  action?: FeatureAction;
  actionLabel?: string;
  overlayNote?: string;
}

export interface FeatureAction {
  type: string;                     // ID из Feature Registry
  preset?: Record<string, unknown>; // INTENT, не императив
}

export interface FeatureSnapshot {
  activeTabId: string;   // from deck.store
  expanded: boolean;     // from deck.store
}

// Sub-Slide модель (добавлено в v2.2)
// Типы Sub-Slide из src/types/show.types.ts (v2.2)
export interface ShowSubSlide {
  imageId?: string;
  title?: string;
  titleColor?: SlideColor;
  description?: string;
  descriptionColor?: SlideColor;
  bullets?: SubSlideBullet[];
}

export interface SubSlideBullet {
  text: string;
  color?: SlideColor;
}

export const SLIDE_COLORS = [
  '#9b59b6', // фиолетовый (default)
  '#e74c3c', // красный
  '#3498db', // синий
  '#2ecc71', // зелёный
  '#f39c12', // оранжевый
] as const;

export type SlideColor = typeof SLIDE_COLORS[number];
```

---

# §6. Store

**Файл:** `src/stores/show.store.ts`

```typescript
interface ShowState {
  // Режим
  activeMode: ShowMode;           // 'entry' | 'scenario'
  // Сценарий
  scenario: ShowScenario;
  activePointIndex: number;
  activeStepIndex: number;
  // Feature state
  featureActive: boolean;
  activeFeatureId: string | null;
  featureSourceStepId: string | null;
  _featureSnapshot: FeatureSnapshot | null;
  // Sub-Slide
  activeSubSlideIndex: number;
  activeBulletIndex: number;
  featureTransition: boolean;        // заглушка для Фазы 2
  featureTransitionLabel: string | null;
  // Presentation
  isPresenting: boolean;
  showSlide: boolean;
  dockPosition: { x: number; y: number };
  // Guards
  scenarioComplete: boolean;
  // Actions
  openScenario / closeScenario
  updateTitle
  addPoint / removePoint / updatePoint / movePoint
  addStep / removeStep / updateStep / moveStep
  nextStep / prevStep / nextPoint / prevPoint
  activateFeature / deactivateFeature
  startPresentation / stopPresentation / toggleSlide
  setDockPosition
  save / load (persistence)
  nextScreen / prevScreen
  getCurrentScreenInfo
}

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
```

**Инварианты:**
- `featureActive === true` → `activeMode === 'scenario'`
- `closeScenario` не работает при `featureActive` или `isRecording` или `isPresenting`
- `activateFeature` → `captureSnapshot()` ДО `execute()` — если execute падает, store не меняется
- `deactivateFeature` → `restoreSnapshot()` → `nextStep()` (автопереход)

**Auto-save:** subscribe на `scenario` changes → debounce 2s → IDB write.

---

# §7. Архитектурная конституция

## Правило 1: Замещение ControlDeck

ShowEditor fullscreen **замещает** ControlDeck в App.tsx. НИКОГДА не рендерить оба одновременно.

```tsx
{syncOpen ? <SyncEditorPanel />
  : showActive ? <ShowEditor />
  : <ControlDeck />}
```

## Правило 2: Z-Index

```
ShowEditor root:       z-index: 999999
Lightbox:              z-index: 999999
SlideOverlay:          z-index: 999998
PresenterDock:         z-index: 999997
FeatureOverlay:        z-index: 999996
ControlDeck:           z-index: 999995
```

Header ShowEditor ОБЯЗАН иметь `background` и `overflow: hidden`.

## Правило 3: Persistence без миграций DB

- Сценарий: `app_state` store в TextAppDB v9, key=`'rec_studio_scenario_v1'`
- Blob картинок: `custom_backgrounds` store в beLive_scenes v1, ключи `rec_img_${imageId}`, trackId=`'rec'`
- Dock position: localStorage key=`'rec_studio_dock_pos_v1'`
- DB_VERSION НЕ МЕНЯЕТСЯ
- Key values НЕ МЕНЯЮТСЯ (backward compat)

## Правило 4: Recording Store

Не создавать свой `isRecording`. Переиспользовать `recordingStore.startRecording()`.

## Правило 5: Keyboard Priority

```
1. useBillyKeyboard (capture:true) → при isPresenting: return сразу (INV-SHOW-KEY-01)
2. PresenterDock keydown → Space(только showSlide)/Escape/↑↓←→ routing
3. ShowEditor keydown → ←→↑↓ навигация (только editor, не presenting)
4. useKeyboardShortcuts → Arrow seek/prevnext (show guard)
5. React synthetic → inputs/textareas
```

**Presentation Runtime routing:**
```
showSlide=true:  ↑↓ = шаги, ←→ = фото карусель (fallback: шаги), Space = скрыть слайд
showSlide=false: Space = показать слайд, ←→ = seek beLive, ↑↓ не перехватываются
Escape: скрыть слайд / стоп запись + стоп презентация
```

**Lightbox routing:**
```
Lightbox open → Escape (capture:true) → закрыть лайтбокс
                Не пропускает Escape к глобальному handler
```

## Правило 6: Feature Registry

Не хардкодить if-ами. Реестр: `registerFeature`, `getFeature`, `captureSnapshot`, `restoreSnapshot`. Перед `execute()` — `captureSnapshot()`, при `deactivate()` — `restoreSnapshot()`.

## Правило 7: Audio A/B (Фаза 2)

GainNode switch с `linearRampToValueAtTime(15ms)` — НЕ snap `gain.value = 0/1`. Click/pop на target hardware недопустим.

## Правило 8: Анимации через @keyframes CSS (не JS)

```
slideContentIn (300ms) → смена слайда
workspaceIn (250ms) → смена шага в editor
carouselImageIn (300ms) → смена фото
dockIn (300ms) → появление PresenterDock
notifIn → toast уведомления
```

---

# §8. Топология компонентов

```
App.tsx
├── {syncOpen} → SyncEditorPanel
├── {showActive} → ShowEditor (z:999999, position:fixed, inset:0)
│   ├── HeaderBar (background ОБЯЗАТЕЛЕН)
│   ├── MainArea (flex row)
│   │   ├── PointList (220px, левая колонка)
│   │   └── StepWorkspace (центр)
│   ├── StepStrip (72px, нижняя лента)
│   └── BottomBar (48px)
├── {else} → ControlDeck
├── {isPresenting} → PresenterDock (z:999997, floating)
│   ├── CompactDock (36px, one row)
│   └── SlideOverlay (z:999998, fullscreen при showSlide)
│       ├── SlideContent (title, subtitle, description, bullets, image carousel)
│       ├── SlideNotes (абсолют, правый верх)
│       └── SlideControls (bottom bar)
│   └── Lightbox (z:999999, при lightboxUrl)
└── {featureActive} → FeatureOverlay (z:999996)
```

---

## §8C Замороженные решения (Frozen Decisions)

| Решение | Статус | Обоснование |
|---------|--------|-------------|
| Раздельные refs: imageInputRef + htmlInputRef | ❄️ | Один ref не обслуживает два input с разным accept |

---

# §9. UX-поток Show

## 9.1 Создание сценария

1. Пользователь открывает таб **Show** в ControlDeck
2. Видит ShowEntry — карточка с кнопкой «Начать сценарий»
3. Клик → ShowEditor fullscreen
4. В левой колонке — пункты (Point), внизу — лента шагов (Step)
5. В центре — StepWorkspace: редактирование текущего шага

## 9.2 Редактирование шагов

**Content Step:**
- Title — заголовок шага
- Subtitle — подзаголовок
- Description — описание
- Bullets — динамический массив тезисов (+ Тезис / ×)
- Images — загрузка фото (drag-drop + файл-пикер + IDB persist)
- `imageCaptions?: string[]` — параллельно imageIds, подпись под каждым фото
- Notes — заметки автора (не видны в записи)
- Batch upload — все файлы одним updateStep (не N ререндеров)

**Feature Step:**
- Action picker из Feature Registry (getAllFeatures)
- ActionLabel — название кнопки активации
- OverlayNote — текст оверлея при активации

## 9.3 Запись (Presentation Runtime)

- Запуск: кнопка **Записать** → PresenterDock mount (dockIn 300ms)
- Слайд: **Space** / 📋 кнопка → SlideOverlay (только при showSlide)
- Закрытие слайда: ✕ кнопка в SlideOverlay или Space
- Навигация: ↑↓ = шаги, ←→ = карусель/шаги
- Toast: "Начинаем запись..." → "🔴 Запись идёт" (3с) → "✅ Сохранена"
- Закрытие: ✕ в dock → стоп запись + стоп презентация

## 9.4 HTML Step

- Upload: клик/drag .html файл → processAndSaveHtml → IDB → htmlId в step
- Preview: iframe sandbox="" (без скриптов — только визуал)
- Slide: iframe sandbox="allow-scripts" fullscreen (data-step-type="html")
- Blur guard: при навигации document.activeElement.blur()
- Loading state: opacity:0 → onLoad → opacity:1 (transition 200ms)

## 9.5 Feature Execution Flow

```
activateFeature()
  → captureSnapshot() из deck.store
  → feature.execute(preset)
  → featureActive = true
  → showActive = false (ShowEditor скрывается)
  → ControlDeck рендерится с нужной вкладкой
  → FeatureOverlay показывает overlayNote + "← Назад"

deactivateFeature()
  → feature.deactivate()
  → restoreSnapshot() в deck.store
  → featureActive = false
  → showActive = true (ShowEditor возвращается)
  → nextStep() (автопереход к следующему шагу)
```

## 9.6 Image Carousel + Lightbox

В SlideOverlay изображения показываются по одному:
- Кнопки ‹ › для навигации между фото
- Счётчик `2 / 4`
- `carouselCaption` под фото если `imageCaptions[index]` не пустой
- Клик на фото → Lightbox (почти fullscreen, 95vw × 95vh)
- Escape → закрыть лайтбокс (capture phase, приоритет над глобальным handler)

## 9.7 HTML Slide (SlideOverlay)

- Рендерится ТОЛЬКО при step.type === 'html' && step.htmlId && htmlSlideUrl
- iframe fullscreen: position absolute, inset:0, width:100%, height:100%
- sandbox="allow-scripts" — интерактивность разрешена
- Loading: opacity:0 → onLoad callback → opacity:1 (transition 200ms)
- htmlSlideLoaded state: false при смене шага, true при onLoad
- Blur guard: onClick nav кнопок → document.activeElement.blur()

---

# §10. Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `src/types/show.types.ts` | Типы данных (ShowScenario, ShowPoint, ShowStep, FeatureAction) |
| `src/stores/show.store.ts` | Zustand store + auto-save + dockPosition + presentation state |
| `src/components/Show/ShowEditor.tsx` | Fullscreen редактор сценария |
| `src/components/Show/ShowEditor.module.css` | Стили редактора (z-index 999999) |
| `src/components/Show/StepWorkspace.tsx` | Inline редактор шагов (content + feature) |
| `src/components/Show/StepWorkspace.module.css` | Стили workspace |
| `src/components/Show/PointList.tsx` | Список пунктов (↑↓× редактирование) |
| `src/components/Show/StepStrip.tsx` | Лента шагов (portal picker! scroll fix!) |
| `src/components/Show/PresenterDock.tsx` | CompactDock + SlideOverlay + Lightbox |
| `src/components/Show/PresenterDock.module.css` | Стили дока + overlay + лайтбокс |
| `src/components/Show/FeatureOverlay.tsx` | Оверлей при feature activation |
| `src/components/Show/ShowEntry.tsx` | Карточка в ControlDeck |
| `src/components/Show/featureRegistry.ts` | Реестр функций (MVP: open-studio-mixer) |
| `src/services/idb.service.ts` | Persistence (loadShowScenario, saveStepImage, etc.) |
| `src/services/show.image.service.ts` | Image pipeline + Object URL lifecycle |
| `src/hooks/useMouseIdle.ts` | Хук idle-детекции (для auto-hide UI) |
| `src/App.tsx` | showActive + isPresenting + PresenterDock + FeatureOverlay |
| `src/deck/modules.ts` | Show регистрация (id:'show', order:29) |
| `src/utils/image-resize.ts` | Ресайз изображений перед сохранением |
| `src/hooks/useKeyboardShortcuts.ts` | Arrow seek/prevnext, show guard |
| `src/hooks/useBillyKeyboard.ts` | Billy keyboard capture, isPresenting guard |

---

# §11. Баги которые мы лечили (не реинтродусить!)

### Баг 1: Scroll прыгает при addStep
**Фикс:** Два useEffect (listener mount-only + restore каждый render) + rAF в handleAddStep.

### Баг 2: ControlDeck + ShowEditor одновременно
**Фикс:** Ternary replacement pattern в App.tsx. `showActive` без `!featureActive`.

### Баг 3: Z-index конфликт
**Фикс:** ShowEditor root z-index: 999999. Header background + overflow: hidden.

### Баг 4: ssTypePicker скрыт за ShowEditor root
**Фикс:** Portal внутрь `[data-show-root]` вместо `document.body`. Пикер внутри stacking context ShowEditor.

### Баг 5: Изображения уходят за viewport
**Фикс:** Image carousel — одно фото за раз + навигация ‹ › + lightbox для увеличения.

### Баг 6: Transform positioning — left:0+top:0 перед translate при drag
**Фикс:** TC-P4a-FIX

### Баг 7: Mass upload race — forEach вызывал N ререндеров
**Фикс:** batch updateStep (TC-UX5b)

### Баг 8: Keyboard stale closures — state в closure вместо ref
**Фикс:** ref + store.getState() вместо state в closure

### Баг 9: HTML charset — IDB теряет charset
**Фикс:** new Blob([blob], {type:'text/html;charset=utf-8'}) (INV-HTML-02)

---

# §12. Frozen-зоны (не трогать)

```
❌ src/audio/core/AudioEngineV2.ts
❌ src/audio/compat/patchV1.ts
❌ src/bridges/**/*.ts
❌ src/services/track.orchestrator.ts
❌ js/**/*.js
❌ src/stores/wordSync.store.ts
❌ src/stores/markers.store.ts
❌ src/triggers/trigger.bridge.ts
```

---

# §13. Persistence backward compat

Persistence key values заморожены для совместимости с существующими данными:

| Key | Store | Что хранит |
|-----|-------|-----------|
| `rec_studio_scenario_v1` | TextAppDB → app_state | Сценарий (JSON) |
| `rec_img_${imageId}` | beLive_scenes → custom_backgrounds | Blob изображения |
| `rec_studio_dock_pos_v1` | localStorage | Позиция PresenterDock |
| `rec_html_${htmlId}` | beLive_scenes → custom_backgrounds | Blob HTML |

Имена ключей содержат `rec_studio` — это **исторический артефакт**, не баг. Менять нельзя — потеряем данные.

---

# §14. Текущий статус MVP

| Компонент | Статус |
|-----------|--------|
| Types + Store + Feature Registry | ✅ |
| Persistence (IDB + images) | ✅ |
| ShowEntry (карточка в доке) | ✅ |
| ShowEditor (fullscreen контейнер) | ✅ |
| App.tsx guards + Keyboard guards | ✅ |
| Layout fix (z-index, replacement, scroll) | ✅ |
| PointList + StepStrip | ✅ |
| StepWorkspace (content editing) | ✅ |
| Bullets (динамический массив) | ✅ |
| Image Upload (drag-drop + IDB) | ✅ |
| Feature Step Editing | ✅ |
| Feature Execution + FeatureOverlay | ✅ |
| Presentation Runtime (isPresenting) | ✅ |
| PresenterDock (compact, 36px) | ✅ |
| SlideOverlay (fullscreen слайд) | ✅ |
| Image Carousel + Lightbox | ✅ |
| Recording интеграция | ✅ |
| Переименование Rec Studio → Show | ✅ |

### TC List

| TC | Фаза | Что |
|----|------|-----|
| P4a-FIX | Фаза 2 (Полировка) | Transform positioning bug (left:0+top:0 перед translate) |

---

# §15. Известные ограничения

| # | Проблема | Приоритет |
|---|----------|-----------|
| 1 | Object URL bounded leak при переключении шагов (чистится при закрытии Show) | 🟡 |
| 2 | Dock position clamp при resize окна — не обновляется | ⚪ |
| 3 | Один сценарий (нет каталога) | 🟡 Фаза 3 |
| 4 | Нет undo/redo | 🟡 Фаза 3 |
| 5 | Нет drag-and-drop reorder шагов (только кнопками) | ⚪ |
| 6 | Feature Registry содержит один MVP entry (open-studio-mixer) | 🟡 Фаза 2 |

---

# §16. Направления развития

## Show как платформа

Show является базовым Story Engine beLive. Архитектура Show (сценарии, шаги, функции, PresenterDock, SlideOverlay) — повторяемая основа для будущих продуктовых поверхностей:

- **Show** — полные контентные сценарии (текущий модуль)
- **Stories** — короткие форматные записи
- **Tutorials** — структурированные обучалки
- **Demos** — продуктовые демонстрации
- **Clips** — быстрые фрагменты

Все эти поверхности могут использовать одну архитектурную основу: ShowScenario → ShowStep → Feature Registry → PresenterDock.

## Фаза 2: Расширение Registry + Polish

- Больше Feature Registry entries: `show-vocal-puzzle`, `open-sync-editor`, `toggle-loop`
- Audio A/B с linearRampToValueAtTime (15ms ramp)
- PresenterDock polish: мини-превью медиа
- Templates: шаблоны сценариев (review, tutorial, devlog, vocal lesson)
- Более умный preset/intent для feature steps

## Фаза 3: Зрелость

- Каталог сценариев (несколько Show-проектов)
- Undo/Redo
- Drag-and-drop для шагов и пунктов
- AI Assistance: Билли помогает собрать сценарий
- Телесуфлер (скроллящийся текст)
- Экспорт сценария
- Медиа: улучшенная работа с фото, будущая поддержка видео

## Чего Show НЕ будет (MVP boundaries)

Show не станет:
- Полноценным PowerPoint / Keynote
- Сложным редактором с анимациями
- Cloud sync сервисом
- Встроенным браузером
- Видеоредактором

---

# §17. Архитектурная карта Show в beLive

```
beLive Runtime
├── Audio Engine (frozen)
├── Bridges (frozen)
├── Stores (mirrors + authorities)
├── Product Surfaces
│   ├── Rehearsal / Karaoke / Concert / Live
│   └── Show ←── ЭТОТ МОДУЛЬ
│       ├── Scenario Editor (ShowEditor fullscreen)
│       │   ├── PointList (левая колонка)
│       │   ├── StepWorkspace (центр)
│       │   └── StepStrip (нижняя лента)
│       └── Presentation Runtime
│           ├── PresenterDock (compact, поверх beLive)
│           ├── SlideOverlay (fullscreen при showSlide)
│           └── Lightbox (fullscreen zoom)
├── ControlDeck (замещается ShowEditor при showActive)
├── FeatureOverlay (при featureActive)
└── Billy / Sync / Catalog / etc.
```

---

*Документ v2.1 утверждён Центр_31.1, 2026-06-03*
*Автор Никита Side-Chaine*
