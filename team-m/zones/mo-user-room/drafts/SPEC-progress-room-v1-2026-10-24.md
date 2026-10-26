СПЕКА: прогресс репетиции + комната (v1.1 · правки Босса 24.10)

ДОГОВОР О ЛОКАЛЬНОСТИ (явно): прогресс живёт на устройстве+браузере (IDB). Кросс-девайс появится ТОЛЬКО с серверным API профиля (GET /auth/me сейчас нет: auth.service:48,54,63,142). Это не блокер — это обещание, которое не даём раньше времени.

1) ЖУРНАЛ
   Хранение: IDB 'TextAppDB' (idb.service.ts:10-11), DB_VERSION 9→10, новый store 'practice_log'
   keyPath 'id' (crypto.randomUUID) · индексы: 'day' (YYYY-MM-DD), 'sessionId', 'kind', 'ownerId'
   type PracticeLogRecord = PracticeSessionRecord | PracticePassRecord
   interface Base { id: string; kind: 'session'|'pass'; at: number; day: string; ownerId: string; migrated?: boolean }
   interface PracticeSessionRecord extends Base { kind:'session';
     startedAt:number; endedAt:number|null; lastSeenAt:number; pausedMs:number; durationMs:number;
     status:'open'|'ended'|'kept'|'cancelled'|'interrupted';
     trackId:string|null; trackTitle:string|null; trackArtist:string|null;
     scenarioId:string|null; blockId:string|null; blockType:string|null; label:string|null;
     passes:number; rateStart:number; rateEnd:number; reachedFull?: boolean }
   interface PracticePassRecord extends Base { kind:'pass'; sessionId:string;
     blockId:string|null; blockType:string|null; passIndex:number; rate:number; label:string|null }
   Зачем: session → минуты/прогоны/streak/«продолжить»; pass → история темпа и освоение.
   ВРЕМЯ: durationMs = endedAt − startedAt − pausedMs; наружу отдаём только активное время.
   ПАУЗА: пауза >30 мин → автозакрытие сессии как 'interrupted' (таймер на 'paused', снимается на 'resumed').
   Ретеншен: prune при init — day < today−365 ИЛИ записей >10 000 (старейшие). ПОЛ: day===today НЕ удаляется никогда. ~1.5 МБ/год.
   Запись только через один модуль (append/close/heartbeat/migrate); UI и агрегации только читают.

2) ХУКИ
   Механика: сервис-подписчик на document-события (эталон dual-publish facade.ts:57). В сторе практики — только 2 новые строки (паузы).
   - practice-session.store.ts:245 'started' → session {status:'open', startedAt, rateStart, blockId=targetBlockId, trackId/title из track.store:19}
   - practice-session.store.ts:401 'pass-complete' → append pass {passIndex, rate, label}; session.passes/rateEnd
   - practice-session.store.ts:412 'completed' → session.reachedFull=true, НЕ закрывать (isActive ещё true)
   - practice-session.store.ts:281 'completed-kept' → close 'kept' + durationMs
   - practice-session.store.ts:267 'ended' → close 'ended' + durationMs
   - practice-session.store.ts:298 'cancelled' → close 'cancelled' (emit ДО set — значения читаемы)
   - practice-session.store.ts:424 pausePractice / :428 resumePractice → ДОБАВИТЬ emit 'paused'/'resumed' (эталон :291); копим pausedMs
   - main.tsx:60-67 registerInit({id:'practice-journal'}) → подписка + prune + закрытие 'open' старше 2ч как 'interrupted'
   - heartbeat setInterval 30с на открытой сессии → lastSeenAt
   Почему сюда: это существующие emit-точки; 'ended'/'kept'/'cancelled' эмитят ДО set.
   КЭШ (условие 009-4): writer фиксирует {sessionId, startedAt, passes, rateEnd, trackId} в module-state на 'started' и 'pass-complete' — ДО любых сбросов. restoreAndCancel:317 эмитит ПОСЛЕ reset → close берёт данные из кэша; кэша нет → пишем только факт (status).
   ONBLOCKED (условие 009-1): «живой open» БЕЗ таймаута запрещён. Политика: держим open, но через 3с — таймаут → отклоняем с флагом journalDisabled (журнал выключен до след. вызова), фон. промис не оставляем висеть; при позднем onsuccess соединение всё равно примется. + одноразовый warn + сигнал в тост-слой.

3) АГРЕГАЦИИ (src/services/practice-journal/aggregate.ts — чистые, без React/IDB)
   - weekStats(sessions, now) → {minutes, runs, streak, spark:number[7]}
   - tempoByBlock(passes, blocks: TextBlock[]) → [{blockId, blockType, label, rates[], rate, passes, mastered, almost}]
   - mastery(rows) → {done, total, almost} — done: rate >= 1.0; almost: 0.95 <= rate < 1.0 (в счётчик НЕ входит)
   - lastSession(sessions) → {trackId, trackTitle, blockId, blockType, rate, at} | null
   - sessionMinutes(s) → number (durationMs/60000)
   - streak(days[], today) → number (день = локальная дата YYYY-MM-DD)

4) ЭКРАН (src/components/profile/, вёрстка — по схеме Босса; GPT-референс не используем)
   КАРКАС (утверждён Боссом): комната = ЭКРАН ВНУТРИ приложения, НЕ оверлей.
   - вызов остаётся surface='profile' (App.tsx:262); фон/backdrop/клик-по-фону убрать (сейчас UserRoom.css:2-11)
   - слой: position fixed, top: var(--react-header-height,64px) (Header.tsx:24-27,41-49), bottom: var(--bl-deck-height,268px) (ControlDeck.tsx:82), left/right 0; z-index ниже 999995 (дек) и 999996 (хедер) — хедер режимов и транспорт остаются живыми, музыка не прерывается
   - закрытие: кнопка «← В студию» + Esc (Esc уже есть: UserRoom.tsx:39-45); клик по фону НЕ используется
   - скролл: скроллится внутренний контейнер (overflow-y:auto), страница не прыгает
   - мобильный: одна колонка на всю ширину, вертикальный поток как в схеме
   - шапка комнаты: заголовок «Комната»; левый раздел «ПРОФИЛЬ» из панели убрать — решение: снять ColHeader «Профиль» в FeedScreen.tsx:50 (контент колонки аватара/статов остаётся), чтобы не было дубля «профиль/комната»
   - ProfileHeader — currentUser/userName/userAvatar/isGuest; guest→CTA; [Настройки][Выйти]
   - WeekStrip — weekStats(); empty → нули + «проведи первую репетицию»
   - ContinueCard — lastSession(); null → скрыт; ▶ ВЕРНУТЬСЯ → startPractice(scenarioId) + переход к blockId (эталон AiExpertPanel.tsx:640)
   - TempoList — tempoByBlock(); empty → «пока нет прогонов»; полоса = rate*100%; ✓ done; полутон almost (0.95–0.99)
   - SessionsPlaceholder — статично «позже: спой с другом или педагогом»
   - SettingsPanel — тема + MVSEP-ключ (как сейчас)
   Состояния: loading — однострочный скелет; ошибка IDB → пустые состояния, не красный экран.

5) ГОСТЬ — МИГРАЦИЯ, НЕ ФИЛЬТР
   Гость пишет с ownerId='guest' → прогресс виден сразу (бейдж «локально»).
   При первом входе: migrateGuestLog(accountId) — один проход по индексу 'ownerId'='guest', cursor.update({ownerId:accountId, migrated:true}); локально, без сервера.
   Guard: если у аккаунта уже есть записи — не мигрируем (защита от повторного прохода); migrated:true — вторая линия защиты.
   Гостевые записи остаются читаемыми, только пока аккаунт так и не появился.
   Sessions — «после входа» (session-SP).

6) ЭТАПЫ + КРИТЕРИИ ПРИЁМКИ
   1. Журнал (без UI):
      • 3 прогона в одном блоке, темпы 0.8/0.9/1.0 → в IDB 1 session (passes=3, rateStart=0.8, rateEnd=1.0) + 3 pass
      • перезагрузка посреди прогона → при boot сессия 'interrupted', durationMs = lastSeenAt − startedAt
      • пауза 10 мин → эти 10 мин НЕ входят в durationMs
      • повторный close не создаёт дубль (идемпотентность status!=='open')
   2. Агрегации:
      • streak через границу месяца/года
      • пустой вход → {0 минут, 0 прогонов, 0 дней, [0×7]}
      • один день с двумя сессиями = 1 день streak
      • mastery: 0.99 → almost (не done), 1.0 → done
   3. WeekStrip + ContinueCard:
      • числа совпадают с ручным подсчётом по IDB
      • ContinueCard показывает последнюю сессию и обновляется после новой
      • пустой журнал → корректные empty-состояния
      • КАРКАС: комната — экран, не оверлей: хедер и транспорт видны и кликабельны, музыка играет при открытой комнате
      • закрытие «← В студию» и Esc работают; клик по фону ничего не закрывает (фона нет)
      • контент скроллится внутри, страница не прыгает; на мобильном — одна колонка
      • «ПРОФИЛЬ» в панели ленты убран (FeedScreen.tsx:50), заголовок комнаты — «Комната»
   4. TempoList + освоение:
      • «освоено N из M», N = count(rate=1.0), M = blocks.store
      • 0.95–0.99 → полутон, в N не входит
      • порядок блоков как в blocks.store
   5. Полировка:
      • guest→login: записи переехали (ownerId=аккаунт, migrated:true), нулей нет
      • повторный вход миграцию не дублирует
      • мёртвый CSS (UserRoom.css:203,217,221,228,235) удалён; surface-миграция; тесты зелёные
   Шаг 1 обязан работать без UI (DevTools/тест).

7) РИСКИ
   - Перезагрузка посреди прогона: 'open'+heartbeat → при boot 'interrupted', duration=lastSeenAt−startedAt
   - Двойной учёт 'completed'→'completed-kept': close идемпотентен
   - Смена трека: trackId фиксируется на 'started'
   - IDB недоступен (private): все записи try/catch no-op, практика не падает
   - Размер: prune 365 дней + 10 000 записей
   - Две вкладки: два 'open' → оба закроются по таймауту; дубль помечается 'interrupted'
   - restoreAndCancel:317 — запись без метрик (только факт), close читает кэш
   - onblocked-зомби — таймаут 3с: промис не висит вечно, журнал деградирует в no-op с сигналом
   - Миграция гостя: если аккаунт уже с данными — не мигрируем (guard), иначе смешение двух историй

8) ОТЛОЖЕНО
   - ELO/рейтинги/лидерборды — нет правил начисления
   - Серверная синхронизация журнала — нужен API профиля (GET /auth/me нет)
   - Друзья/совместные сессии — session-SP (R2-7)
   - PRO/подписка — не тащим
   - Кросс-девайс — следствие серверной синхронизации (см. ДОГОВОР)
   - metrics.store — frozen (App.tsx:67)
