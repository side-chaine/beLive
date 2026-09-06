# SHOW-IMMERSION-B03-2026-09-06 · 🛡 [B03] agent-show — ДОКЛАД «ПОГРУЖЕНИЕ»

**Модель:** agent-show = Big Pickle Zen · ПК · Linux · HEAD `26e9256`
**Канон (сверен живьём 06.09 13:30):** tsc 184 (в зоне Show — **0**) · vitest 812/68 (тест зоны **5/5 🟢**) · reach **0 violations / 51 hold** (флагов зоны — **0**) · junction 7 пар (стыков зоны — **0**; 3 viol — CF-секретная очередь Никиты, CI-grace)
**Формула:** ① погружение (этот доклад) → ② СТОП → ③ план развития — Никита. Волна-2.

---

## 1. ЗОНА — КТО ТАКОЙ SHOW

Кадастровый профиль (`houses.yaml:134`): **«Режиссёр номера: собирает выступление из готовых сцен»**. Дом B03 `alive`, район rehearsal, arch lab, `route: show`, owner 007.

Пользователь собирает **сценарий показа** (пункты → шаги → под-слайды), редактирует его в полноэкранном редакторе и показывает через плавающий док презентации поверх основным экранам beLive.

**Пути зоны:** `src/components/Show/**` (13 файлов) · `src/services/show.html.service.ts` + `show.image.service.ts` · `src/stores/show-editor.store.ts` + `show-presentation.store.ts` + `show.store.ts` · `src/types/show.types.ts` · тест `src/stores/__tests__/show.store.test.ts` (5/5).

**Git-история зоны:** рибренд Rec Studio → Show (`9e47cf5`) → sub-slide архитектура (`4872a56`, модель+навигация+редактор+batch drop) → тихо с тех пор (снапшоты не в счёт).

## 2. АРХИТЕКТУРА (все цифры wc -l, якоря верифицированы скаутом)

```
deck/modules.ts:33 (ShowEntry lazy, вкладка ControlDeck, order 29, режимы rehearsal/karaoke/concert/live)
  └─ ShowEntry.tsx (25) — карточка-вход, кнопка «Начать сценарий» → openScenario
       └─ App.tsx:53-56 (useShowStore, ShowEditor, FeatureOverlay, PresenterDock)
            ├─ ShowEditor.tsx (153) — каркас: ResizeObserver→--bl-deck-height, клавиатурная навигация
            │    ├─ PointList.tsx (130) — пункты слева (CRUD + move)
            │    ├─ StepStrip.tsx (214) — полоса шагов-чипов + type-picker (portal)
            │    └─ StepWorkspace.tsx (886) — редактор шага по типу: content-subslides / legacy-content / feature / html; drag&drop, sub-slide CRUD
            ├─ PresenterDock.tsx (655) — перетаскиваемый док презентации + полноэкранный слайд + lightbox + хоткеи
            └─ FeatureOverlay.tsx (49) — оверлей feature-шага (ноут + REC-таймер + «Назад»)
Stores:
  show-editor.store.ts (753) — МОЗГ зоны: activeMode(entry/scenario), сценарий Points→Steps→SubSlides, навигация, автосейв (subscribe→2s, :749-753), lazy-миграция legacy→subSlides (:53-109), persist в IDB (:707-728)
  show-presentation.store.ts (60) — ДУБЛИКАТ презентации, 0 потребителей вне барреля (см. §7)
  show.store.ts (6) — баррел; useShowStore помечен @deprecated (:5), но именно он и жив (10 потребителей)
Сервисы:
  show.image.service.ts (64) — resize → IDB → objectURL; lifecycle URL (create/revoke/deferred)
  show.html.service.ts (52) — File→IDB→iframe objectURL; оригинальный File сохраняется целиком (кодировка, :34-36, INV-HTML-02), charset=utf-8 принудительно
  └─ обе → idb.service.ts: сценарий в app_state (key rec_studio_scenario_v1), картинки/HTML в beLive_scenes/custom_backgrounds (rec_img_*/rec_html_*, trackId 'rec')
featureRegistry.ts (81) — Map feature-действий + snapshot deck; СЕЙЧАС 1 фича: open-studio-mixer (:62-81: captureSnapshot + deck.setTab('mixer'))
types/show.types.ts (93) — ShowMode/StepType/ShowScenario/ShowPoint/ShowStep/ShowSubSlide/FeatureAction/FeatureSnapshot
CSS: StepWorkspace 885 · PresenterDock 721 · ShowEditor 657 (+2 малых) — крупные, @media НЕТ
```

**Суммарно ~5.5K loc** (компоненты+stores+сервисы+типы). Кадастр говорит loc 4585/files 13 — сходится по компонентам, остальное — stores/сервисы вне `components/Show`.

## 3. ЖИВЫЕ СВЯЗИ (таблица импортёров)

| Потребитель | Якорь | Что берёт |
|---|---|---|
| StepWorkspace.tsx | :8,13 | processAndSaveImage/load/remove/revoke + processAndSaveHtml/loadStepHtmlUrl |
| PresenterDock.tsx | :4,5 | loadStepImageUrl + loadStepHtmlUrl/revokeAllHtmlUrls |
| show-editor.store.ts | :7-8 | featureRegistry + recording.store |
| show-editor.store.ts | :707,716,728 | idb.service (saveShowScenario/loadShowScenario) |
| App.tsx | :53-56,239-249 | useShowStore + 3 компонента; прячет остальной UI флагами !showActive/!featureActive |
| ControlDeck.tsx | :24,33-34 | featureActive, deactivateFeature |
| useKeyboardShortcuts.ts | :4,20,71 | guard стрелок/space при activeMode==='scenario' |
| useBillyKeyboard.ts | :15,49 | guard Билли при активном сценарии |

**[renamed]-кейс 301 — ЗАКРЫТ/ПОДТВЕРЖДЁН:** show-сервисы живы, 4 импортёра в 2 файлах — ровно как в патче `houses.yaml:138` (`[cleared]→[renamed]`, применён 007 22:50 05.09). Старых имён (show.html.ts/show.image.ts) в src — 0.

## 4. EVENTBUS — ЗОНА НЕ НА ШИНЕ

Публикаций/подписок **0** — ни `useEvent`, ни `.emit/.on` (только нативные DOM keydown/mousemove/mouseup). Зона самодостаточна на zustand + DOM-хоткеи. Согласование с глобальной клавиатурой — **read-only** через `useShowStore.getState()` в чужих хуках (§3). Город рисует зону 2 входящих событий (`sync:active-line-changed` m-line, `ui:block-scenes-loaded` m-scenes, houses.yaml:467-500) — **в коде зоны получателей НЕТ** (кадастровые рёбра описывают стык районов, не живые подписки). Честно: НЕ ПРОВЕРЕНО, задумывался ли приём этих событий — знаю только факт «не принимаются».

## 5. МОДЕЛЬ ДАННЫХ (types/show.types.ts)

- **ShowMode** `entry|scenario` (:2) · **StepType** `content|feature|html` (:5)
- **ShowScenario** (:57): `{title, points[], updatedAt}` → **ShowPoint** (:64): `{id, title, steps[]}` → **ShowStep** (:71): content-поля (title/subtitle/description/bullets/imageIds/background/notes/**subSlides**) · feature-поля (action/actionLabel/overlayNote) · html (htmlId)
- **ShowSubSlide** (:47): `{imageId, title+titleColor, description+descriptionColor, bullets[]}` — под-слайд с индивидуальными цветами
- **FeatureAction** (:8) `{type, preset?}` · **FeatureSnapshot** (:21) `{activeTabId, expanded}` — снимок deck для restore после feature-шага

## 6. ЦИФРЫ ПУЛЬСа ПО ЗОНЕ (сняты живьём 06.09 13:30)

| Гейт | Всего | Зона Show |
|---|---|---|
| tsc | 184 ошибок | **0** |
| vitest | 812 pass / 68 files | show.store.test.ts **5/5** 🟢 |
| reach (G-1) | 0 viol / 51 hold / 70 H-1 excluded | **0 флагов** (ни viol, ни hold) |
| junction (G-7) | 7 пар, 3 viol (CF-очередь Никиты, CI-grace) | **0 пар зоны** |
| кадастр bLb | B03 alive | этажи: «Сцены» + «Сценарии [renamed]» — правда |

## 7. СМЕРТЬ ВНУТРИ ЖИВОГО (кандидаты, РЕШЕНИЕ — НЕ МОЁ, список для плана)

1. **show-presentation.store.ts (60) — мёртвый дубликат** презентации (isPresenting/старт/стоп). 0 потребителей вне барреля. Reach НЕ видит (баррель импортирует) — класс «мёртвый, но с живой ссылкой», гейтами не ловится.
2. **@deprecated на живом:** show.store.ts:5 маркирует useShowStore deprecated, но это единственный реально используемый экспорт (10 файлов). Маркировка врёт — она про переезд на show-editor, который не случился.
3. **Заглушки «Фазы 2» (0 вызовов):** featureTransition/featureTransitionLabel (show-editor.store:133-135, 229-230) · getCurrentScreenInfo (:178,:535, export :191) · moveStep (:168,:367).
4. **Экспорты без потребителей:** getFeaturesByCategory (featureRegistry:54) · deferredRevokeStepUrls (image:28) · revokeHtmlUrl/removeStepHtml (html:24,50) · deleteStepImagesByPrefix (idb.service:581).
5. **Двойная дорожка legacy:** миграция legacy→subSlides ленивая (:53-109), но legacy-рендер оставлен как safety net (PresenterDock:261,499,517 · StepWorkspace:76,84,770).
6. TODO/FIXME/HACK — **0** (чисто).

## 8. ВНЕШНИЕ ВЕРДИКТЫ ПО ЗОНЕ

- **PHONE-аудит (06.09 12:34):** ShowEditor/PresenterDock — фикс 220px панели, **0 @media**, mouse-only драг (PresenterDock.tsx:339) → 🔴 телефон / 🟡 планшет. Топ-5 боли №4. Спека фазы-2 придёт от PHONE-агента — жду её как вход.
- **Новый дизайн Репетиции (GPT-контракт 3-колоночности, отказ от нижнего ДОК):** ShowEntry живёт вкладкой ControlDeck — при редизайне хаба точка входа зоны двигается. Стык B01-HUB ↔ B03 — вопрос к хабу, не ко мне.

## 9. ЧЕСТНОЕ «НЕ ЗНАЮ» / ВОПРОСЫ К ПЛАНУ НИКИТЫ

1. НЕ ЗНАЮ целевого вектора Show как **отдельной разработки** (решение Никиты 06.09 12:00) — жду план.
2. НЕ ЗНАЮ, зачем заготовлена «Фаза 2» (featureTransition, экранная навигация getCurrentScreenInfo, moveStep) — какой сценарий имелся в виду?
3. Судьба мёртвого дубля presentation-store: снос (в очередь demolition?) или оживление — 🔴 решение Никиты/цепи.
4. Мобильная адаптация зоны: входит ли в план (PHONE боль №4) или Show — десктоп-инструмент by design?
5. FeatureRegistry: расширять ли список фич (сейчас 1: open-studio-mixer) — каков каталог задуманных feature-шагов?
6. Куда переезжает ShowEntry при новом дизайне Репетиции.

---

**СТОП.** Формула шаг-1 завершена: погружение сдано, доклад в реестре (LOG 13:37). План развития — жду от Никиты. src/ не тронут (0 байт, read-only погружение).

— agent-show [B03] · 06.09 13:37 · театр вскрыт, сцена чистая, жду сценария от режиссёра 🎭🛡
