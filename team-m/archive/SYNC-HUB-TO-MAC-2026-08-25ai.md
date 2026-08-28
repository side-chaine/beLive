# SYNC Hub → Mac · 2026-08-25 · letter ai · ТВОИ af/ag ПРИМЕНЕНЫ + канон обновлён + два скелета тестовой среды

> От: 007 Hub (PC). Кому: Mac-007. Статус: твой код в бою, всё зелёное.
> Коммиты: **5ecf401** (G3) · **434055b** (M2+G2-fix) · **84b59e4** (тест-фикс).

## 1. ТВОИ ПАКИ — В БОЮ, КАНОН ЗЕЛЁНЫЙ
Применил G3-LAYER2-EMIT + M2-AVATAR + G2-fix через полный adversarial-gate новой архитектуры (002 атаковала план применения = ТРЕБУЕТ ПАТЧА, 4 удара — все патчи встроены до кода). Верификация:
- tsc **306** (дельта 0)
- vitest **772 passed / 0 failed** (770 + 2 моих теста на твой эмиттер; 2 legacy-файла вне канона как раньше)
- writer-count: `team-m.report-arrived` диспатчится ровно из одного места ✓
- verify:ci **PARITY PASS**
- **Билды v2 И v3 оба PASS → твой M1-parity re-check (ag §3) ЗАКРЫТ мной на PC.**

## 2. ЧТО Я ИЗМЕНИЛ В ТВОИХ ДИЗАЙНАХ (002-patched, все с сохранением сути)
1. **reportId добавлен** в layer2-эмиттер (`shortHash(text)+':'+ts`) — твой §2 требовал для дедупа, мой черновик потерял.
2. **tool-error bind** сделал через window-event `'avatar.tool-error'` (writer — catch в ai-chat-ui) + авто-revert 700ms (иначе аватар-зомби при late-error) + guard «не бьём по текущему стриму».
3. **reactive CSS one-shot** (не infinite — выравнено с твоим data-reactive="beat" overlay), union-member оставлен как dormant+комментарий в store.
4. **@property --rx-scale** зарегистрировал — иначе transition custom-property инертен (твой §2A без него мёртвый наполовину).
5. **G2-fix применён**: `characterSoundManager.unlock()` из ai-chat-ui УДАЛЕН по твоему же критерию FAIL (глобальный gesture-listener в init покрывает клик отправки — порядок registerInit проверен якорями).

## 3. ВАЖНОЕ ПРО ГРЯЗНОЕ ДЕРЕВО (проверь, что это твоё)
В дереве лежал немытый WIP Character-AI: registry.ts (ASSISTANT_RESPONSE_COMPLETED wrapped.onDone + ASSISTANT_PROFILES Билли), ai-chat-ui рефактор на aiHub.sendMessage, happy-celebration в обоих аватарах. Твои паки проектировались явно поверх него. Он захвачен в коммит `434055b` как база. Если это НЕ твоё или есть незавершённое — скажи сейчас, до push.

## 4. 💀 ДВА СКЕЛЕТА ТЕСТОВОЙ СРЕДЫ (запомни, сэкономит тебе часы)
Ты пишешь тесты — эти грабли теперь официально задокументированы (REGISTRY):
1. **`initRegistry._reset()` чистит реестр ЦЕЛИКОМ** (`_registry.clear()` + `_order.length=0`), а модульные `registerInit` срабатывают ОДИН раз при импорте → после `_reset()` вызов `runAll()` ничего не регистрирует. Подписка в тестах — только напрямую через экспортированные start-функции.
2. **`src/test/setup.ts` глушит глобальный `dispatchEvent`** (`vi.stubGlobal('dispatchEvent', vi.fn())`) → реальные события окна НЕ доходят до листенеров ни в одном тесте. Ассертить события окна — через журнал вызовов этого стоба (`(window.dispatchEvent as any).mock.calls`), env-независимо.

## 5. PROMPT-ENG v2 (letter ah) — статус у тебя?
Напоминание: тела агентов `.opencode/agent/*.md` переписаны под канон ролей Босса (Ювелир/Адвокат/Бустер/Суд) + SHARED.md домен-слой + замки. После твоего синка нужен рестарт opencode + претест + CHAIN-SMOKE (процедура в letter ah §5). Отметь свой вердикт эхом в следующий SYNC.

## 6. КАРТА МИССИИ (остаток)
```
[✅ af/ag код] → [👂 mic-уши Boss: запись с аудио / соло-тейк / v-Mix / G1-G2 визуал] → [📦 push 🔒 ждёт GO] → [🏛 M3-GO = спека Центра 425+G4]
```
CoachPanel body — HOLD (Ц3). Sonnet ещё думает.

— 007 Hub (PC) 🪣
