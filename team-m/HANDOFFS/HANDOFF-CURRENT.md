# HANDOFF-CURRENT · 007 · зона MO-user-room (комната пользователя)
**Снимок: 2026-10-26 19:4x · HEAD `bd9cad7` · `_h` по протоколу 12 слоёв**
> Предыдущий снимок: `HANDOFF-MO-CATALOG.md` (05.10, другая тема). Отдельного HANDOFF-CURRENT до этого не было — создан впервые.

---

## 1. РОЛЬ
**007 (primary)** — разведчик, упаковщик контекста, координатор цепи. По этой теме — **владелец зоны `MO-user-room`** («комната пользователя»).
Пишу только артефакты `team-m/` и промпты; **код пишет operator** по MICRO-PACK. Архитектурные решения — Центр (001/002/009), продуктовые — Босс.

## 2. КУРС (слово Босса)
Комната = **экран внутри приложения** (не модалка), хедер и транспорт живые. Показываем только то, что репетиция реально рождает: **минуты · прогоны · дни подряд · темп по блокам**. **Без ELO, рейтингов, лидербордов, PRO.** Прогресс **локальный** (устройство+браузер); кросс-девайс — только с серверным API профиля.
Процесс: **сначала живой тест на `http://127.0.0.1:3000/beLive/`, пуш — только когда всё настроено.** Браузерные проверки — через Босса (скрины/логи), автоматику не гоняем.

## 3. СОСТОЯНИЕ
- HEAD: **`bd9cad7`** (24.10, VK/TG-вход).
- Рабочее дерево: **190 изменённых/новых** — чужие WIP (blocks/, services/, team-m/) не трогал.
- Мои/оператора изменения: `src/services/practice-journal/` (6 файлов, new), `src/components/profile/room/` (3 файла + тест, new), `UserRoom.tsx/.css`, `QuickActions.tsx`, `main.tsx`, `idb.service.ts`, `practice-session.store.ts`, `package.json`+`package-lock.json` (fake-indexeddb).
- **Этапы:** 1 (журнал) — **принят**; 2 (агрегации) — **принят**; 3 + 3b + 3c (каркас/компакт/bento) — **применены, ждут визуального ОК Босса**.
- **API OpenCode Console восстановлен 26.10** (ключ заменён в `~/.local/share/opencode/auth.json`, бэкап в `~/.opencode-backups/auth.json.bak-20261026`). Проверено: `opencode run --standalone -m opencode/deepseek-v4.1-flash-free` → ответ есть; штатный сервер тоже.

## 4. АРХИТЕКТУРА (принята цепью 001→002→001→009, вердикт ОТЛОЖЕНО→4 условия закрыты)
- **IDB**: `TextAppDB`, `DB_VERSION 9→10` (`idb.service.ts:11`). Новый store **`practice_log`**, keyPath `id`, индексы **`day`/`sessionId`/`kind`/`ownerId`** (`:169-174`).
- **Две формы записи**: `session` и `pass` (дискриминатор `kind`).
- **Время**: `durationMs = endedAt − startedAt − pausedMs`; пауза **>30 мин → автозакрытие `interrupted`**; heartbeat 30 с; `open` старше 2 ч → `interrupted` на boot.
- **Ретеншен**: prune `day < today−365` или >10 000 записей; **пол: `day===today` не удаляется никогда**.
- **Гость**: `ownerId='guest'`, при первом входе `migrateGuest(accountId)` — **read-modify-write** `cursor.value` (частичный объект стирает запись!), guard: у аккаунта уже есть записи → не мигрируем; `migrated:true` — вторая защита.
- **onblocked**: не reject сразу — warn один раз + таймаут 3 с → reject + `_dbPromise=null`; внутренний `catch` на промис (нет Uncaught).
- **Слои**: `idb.service.ts` (соединение, экспорт `getDB/tx/req`) → `practice-journal/{types,date,idb,aggregate,queries,init}` → UI `room/{WeekStrip,ContinueCard,useJournal}` → `UserRoom.tsx`.
- **Подписка**: `document.addEventListener` на `practice:started|pass-complete|completed|completed-kept|ended|cancelled|paused|resumed` — **не через EventBus** (map неполон: `facade.ts:54-60`).

## 5. ЧТО ПОСТРОЕНО (LOC)
| Файл | LOC | Роль |
|---|---|---|
| `practice-journal/types.ts` | 49 | типы записей |
| `practice-journal/date.ts` | 18 | `localDay`, `shiftDay` (локальный календарь) |
| `practice-journal/idb.ts` | 341 | единственный писатель: append/close/heartbeat/prune/migrate/closeStale + module-кэш |
| `practice-journal/init.ts` | 147 | подписка на 8 событий, таймеры паузы, prune+closeStale на boot |
| `practice-journal/aggregate.ts` | 151 | 6 чистых функций (без React/IDB) |
| `practice-journal/queries.ts` | 26 | чтение для UI |
| `components/profile/room/WeekStrip.tsx` | 66 | «Эта неделя» (пропсы) |
| `components/profile/room/ContinueCard.tsx` | 35 | «Продолжить» (пропсы) |
| `components/profile/room/useJournal.ts` | 77 | загрузка + refresh по событиям |
| `components/profile/UserRoom.tsx` | 277 | экран комнаты (bento) |
| `components/profile/UserRoom.css` | 632 | сетка/токены/мобильный |
| тесты | — | `practice-journal.test.ts` 6 + `aggregate.test.ts` 12 + `room.test.tsx` 2 |

## 6. ПРАВИЛА (в силе)
- §10 контекст-рефреш перед действием; §11 цепь последовательно + сквад-память; §12 запись в SHARED-REGISTRY через diff→insert→cp.
- **DISPATCH v2** (Atria-калибровка): КАНОН БОССА + СКВАД-ПАМЯТЬ + канон-анти-дрейф + миниатюра. Скилл: `SELF-TUNE-007-2026-09-17.md`.
- **FROZEN**: защищённых файлов в репо фактически НЕТ (проверено), но триггер жив: любое упоминание = стоп для 007.
- **Пуш — только по слову Босса.** Коммит — снимок по `_h`.

## 7. РЕЕСТРЫ
- `team-m/ROADMAP-MO-user-room.json` **v7**: MR-1 done · MR-2 done · MR-3/4/5/6 planned.
- Спека: `team-m/zones/mo-user-room/drafts/SPEC-progress-room-v1-2026-10-24.md` (**v1.1**, 116 строк, все условия 009).
- Паки: `MICRO-PACK-MR-1`, `MR-2`, `MR-3`, `MR-3b`, `MR-3c` (в той же папке).
- Кросс-запросы RUN-2: `team-m/TRIGGERS/003.md` → MO-session-SP, MO-practice, MO-welcome.
- RUN-1/RUN-2 артефакты: `RUN-STATE-CHAIN*`, `RESEARCH-005x*`, `SCOUT-PACK-RUN-2`, `RUN-2-DESIGN`, `SELF-TUNE`.

## 8. ЛЮДИ / ВНЕШНИЕ
- **Босс (Никита)** — источник продукта и единственная приёмка визуала; тестирует на `127.0.0.1:3000/beLive/`.
- **operator** — пишет код по пакам (стабильно сдаёт gates).
- **001/002/009** — цепь: архитектура/стресс/вердикт.
- **Центр_1 (GLM 5.3, chat.z.ai)** — планируемый внешний ревьюер упакованного среза.
- **OpenCode Console** — провайдер ключа; ключ перевыпущен 26.10.

## 9. ОТКРЫТО
1. **Визуальный ОК Босса** по MR-3c (bento) — скрин ждём.
2. **Этап 4** — реальный «Твой темп» (TempoList из pass-записей) + «Освоено N из M».
3. **Этап 5** — миграция гостя при входе, настройки, чистка тестов.
4. **Пак для Центра_1** — `CENTER-PACK-USERROOM/` (структура согласована, ждёт скринов и границ).
5. **`/tmp` переполнен** (tmpfs 2.9 ГБ, 100%; 953 МБ в `/tmp/opencode`, из них ворктри `wt-*` ~640 МБ + зипы ~130 МБ). **Обход для тестов/билда: `TMPDIR=/home/nikit/.cache/tmp`.** Чистку чужого не делал — нужно слово Босса.
6. `opencode.db` = **21 ГБ** (`~/.local/share/opencode/`), WAL 566 МБ — на `/` места хватает (899 ГБ), но стоит знать.
7. **CORS в dev**: `auth.mybelive.com` и `belive-feed-bot...workers.dev` разрешают только `app.mybelive.com` → на `127.0.0.1` ошибки в консоли. Вне зоны комнаты.
8. **Долг безопасности**: MVSEP-ключ персистится в localStorage открытым (`user-profile.store` partialize) — известный, не чиним в этой задаче.

## 10. ДЕНЬГИ
- Балансы провайдеров в этой сессии **не проверялись** — «не установлено».
- Известно из истории: `b-ai` был мёртв (balance=0), цепь переведена на Atria/DeepSeek; OpenCode Console ключ истёк и перевыпущен 26.10.
- PRO/подписка в комнату **не тащится** (решение Босса).

## 11. СЛЕДУЮЩИЙ ШАГ
1. Получить скрин MR-3c → точечные правки, если нужны.
2. **Собрать `CENTER-PACK-USERROOM/`** для GLM 5.3: README · STATE · SPEC · ARCHITECTURE · CONTRACTS · REVIEW-TASKS · ACCEPTANCE · `code/` · `screens/` · `logs/` · MANIFEST; секреты вырезать; zip.
3. После ревью — этап 4 (TempoList), затем этап 5.

## 12. САМОПРОВЕРКА (живые чтения, 26.10 19:4x)
| проверка | команда | результат |
|---|---|---|
| типы | `npx tsc --noEmit` | **181** ошибка (baseline 181, новых 0; в practice-journal 0) |
| тесты | `TMPDIR=/home/nikit/.cache/tmp npx vitest run` | **906 passed / 77 files**, 0 failed |
| сборка | `TMPDIR=... npm run build` | **exit 0** |
| живой сервер | `curl 127.0.0.1:3000/beLive/` | **HTTP 200** |
| зона `src/components/profile` + journal | `git status` | изменены только ожидаемые файлы |
| секреты | артефакты team-m | ключей/токенов нет |

> ⚠️ Без `TMPDIR` тесты и билд падают `ENOSPC` — это состояние `/tmp`, а не код.
