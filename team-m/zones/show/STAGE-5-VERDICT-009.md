# STAGE-5-VERDICT-009 · B03 Show · ПРИЁМКА ЦЕПИ · 2026-09-07

> Этап-5 (финал). 009 независимо проверил 40 клеймов цепи по живому коду.

## МЕТА-СТРОКА 009

**009: цепь = ДЕРЖИТ; проверено клеймов = 40 (40 подтв / 0 опров); смоук-предсказаний = 8; расхождений = 3 (+1 флаг); готовность к Оператору = да** — фаза-1 может идти в имплементацию; утечку displayStream включить в чек-лист L3, show-presentation.store-дубль проверить до L1.

## КЛЮЧЕВЫЕ ПОДТВЕРЖДЕНИЯ (40/40, сокращённо)

C1 opaque-origin блокирует инжект (PresenterDock.tsx:578-585, превью жёстче sandbox="" StepWorkspace.tsx:434-439; iframe в src/ ровно 2, оба Show) · C2 gateway режet tool_calls (gateway/src/index.ts:294 — только delta.content; /v1/models не проксируется) · C3 stem-reactive зануляет при REC от любого рекордера, audio-reactive — нет (stem-reactive.ts:43-50; writer :136-140) · C4 rec-модуля нет, ветка мёртвая (deck/modules.ts 7 модулей; ControlDeck.tsx:137,147,152) · C5 двойной рекордер без гейта (takes.store.ts:81-86 × recording.store.ts:110; MicSourceV3.ts:33-53 refCount) · C6 transitionPreset не в export.json (zip-export.service.ts:167-181; поле живо idb.service.ts:47-48) · C7 zod в deps 0 импортов (package.json:11) · C8 V3-дыра mic (recording.store.ts:50-53; дефолт v3 engine-mode.ts:4-5) · C9 выход только автоскачивание (:87-97) · C10 iframe перезагружается на шаг + revokeAll на unmount (PresenterDock.tsx:115-129, 298-301) · C11 глобальный Set / per-URL уже есть (show.html.service.ts:5,24-27) · C12 BillyDock в кадре при презентации (App.tsx:77,246) · C13 AIChatPanel-труп + CatalogBillyChat спит · C14 15 тулзов + PLAYER_TOOLS-гейт + серийный раннер · C15 TRACK CONTEXT без Show (AiExpertPanel.tsx:373-379) · C16 триггеры audio/section/loop без детекторов · C17 ZIP в память целиком, по расширению (upload.service.ts:693-695,718-722) · C18 автосейв только на scenario (show-editor.store.ts:749-753) · C19 канон 181/812/68 по реестру-SSOT.

## СМОУК-ПРЕДСКАЗАНИЯ ОПЕРАТОРА (S1-S8)

S1 REC с музыкой+голосом (webm: музыка И речь; краш → ≤1с чанков) · S2 перекрёстный гейт рекордеров (обе стороны отказывают параллель) · S3 префлайт-бейдж до REC (причина отказа видна, не молча) · S4 встроенный live-слайд анимируется от --bl-audio-* ВНУТРИ iframe; при REC stem-вары замирают+--bl-rec; без трека жив на --bl-t; пользовательские rec_html_* мост НЕ получают (честно) · S5 смена шага → пере-handshake без утечки портов; revokeAll в мост-пути нет · S6 экспорт ZIP show.json+assets; импорт с превью «заменить/отмена»; бомба отклоняется ДО распаковки · S7 3 шаблона (Урок/Разбор/Эпизод) × 6 шагов; «Стемы» → open-studio-mixer; копия не мутирует шаблон · S8 чат 🤖 «собери стек» → карточки [ACTION:], клик применяет; tools-param в запросах НЕТ.

## ГЕЙТЫ У1-У5 → ПРОВЕРКИ

У1 → S4 (сниппет + встроенные слайды + честная строка в доке) · У2 → S8 (ACTION-only фаза-1; grep tools-param в Show-запросах = 0) · У3 → S2 (оба start-пути видят соседа) · У4 → S4 (freeze-last-value + --bl-rec + --bl-t; R6) · У5 → S6 (size-cap/entry-count/ratio по центр-директории ДО extraction + magic-bytes).

## РАСХОЖДЕНИЯ (3 + флаг)

1. **Утечка displayStream при V3-return (цепь НЕ заметила):** recording.store.ts:32-35 получает display-стрим ДО v3-проверки :50-53; return без stop() → захват экрана (индикатор браузера) висит до перезагрузки. Не блокер: L3 фазы-1 переписывает startRecording целиком — баг умирает попутно. Включить в чек-лист L3.
2. Якорь-дрейф STAGE-2 T5 («пустой сценарий :266» → фактически :16/:218). Суть верна.
3. Канон-дрейф смежных артефактов (184 в старых погружениях vs 181 после сноса-30). Некритично.
4. ФЛАГ: show-presentation.store.ts — параллельный isPresenting-стор (проверить до L1 persist-delta).

## ВЕРДИКТ

**ЦЕПЬ ДЕРЖИТ.** Расхождения не ломают ни одного решения цепи. Готовность к Оператору = ДА.
