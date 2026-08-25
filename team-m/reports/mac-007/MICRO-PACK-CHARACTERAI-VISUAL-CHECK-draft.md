---
agent: mac-007 (Ф001 Со-Архитектор beLive)
task: MAC-007 CHARACTER-AI visual verification protocol + M1 parity re-check plan
source: task-файл V007 (G1/G2 применены, M1=M007:REWORK ПК-инфра)
mode: READ-ONLY src/ — design/spec pack, НЕ править src
status: draft
updated: 2026-08-25
---

# MICRO-PACK: CHARACTER-AI VISUAL CHECK (draft)

Роль: спроектировать ПРОТОКОЛ визуальной верификации Character-AI + план M1 parity re-check.
Зона ответственности: Мак (Character-AI: Billy/Expert чат, аватар happy/cue, gesture-unlock).
Исполнитель тяжёлых билдов: **PC** (на Маке нет node). Мак поставляет только протокол + якоря.

---

## §1 G1 verif — cue + аватар happy НЕ гаснет при ошибке тула

### Сценарий (точный)
1. Открыть Billy/Expert чат (toggle-loopblock-mode), ввести сообщение, дождаться стрима.
2. После завершения ответа (onDone) аватар переходит в `data-state="happy"` + `avatar.store.state = 'happy'` (синхронно + re-assert через `setTimeout(apply,0)`).
3. Одновременно проигрывается звуковой cue (CharacterSoundManager).
4. **Вброс ошибки тула**: ответ содержит команду, `checkForToolCalls` падает (executeToolCall бросает).
5. Ожидание: аватар **держит happy** 700мс, затем переходит в `idle` (или `listening` если isStreaming), звук cue НЕ зависит от тула. Аватар НЕ переходит в `error`.

### Якоря (что проверять, file:line)
- Триггер события ДО onDone (критично для G1):
  - `src/js/ai/registry.ts:112-119` — wrapped.onDone диспатчит `ASSISTANT_RESPONSE_COMPLETED` (line 115) **раньше** чем `callbacks?.onDone` (line 118). → avatar/sound подписаны на событие, а не на onDone чата.
- Аватар happy (Full):
  - `src/avatar/FullAvatar.tsx:127-144` — `onCompleted` → `apply()` happy (line 132), re-assert (134), revert через 700мс (135-140).
  - `src/avatar/FullAvatar.tsx:142` — `aiHub.on(ASSISTANT_RESPONSE_COMPLETED, onCompleted)`.
- Аватар happy (Fallback / lite-тiers):
  - `src/avatar/FallbackAvatar.tsx:79-96` — идентичный блок, line 84 apply happy, line 94 подписка.
- Звуковой cue (контракт §4):
  - `src/character/sound/CharacterSoundManager.ts:55` — `init()` подписка на `ASSISTANT_RESPONSE_COMPLETED` → `playCue()`.
  - `src/character/sound/CharacterSoundManager.ts:74-81` — `playCue` (CUE_DEFAULT 880→1760 sine ~0.2s gain .15, line 20-25).
- G1 изоляция ошибки тула:
  - `src/js/ui/ai-chat-ui.ts:109-114` — `onDone` → `this.checkForToolCalls(fullText).catch(toolErr => console.error('non-fatal'))`. Ошибка тула НЕ пробрасывается.
  - `src/js/ui/ai-chat-ui.ts:348-355` — `checkForToolCalls` (executeToolCall), внешний try/catch handleSend (122-131) ловит сеть, но событие уже ушло на line 115 registry.

### PASS / FAIL
- **PASS**: аватар `data-state="happy"` в момент [t_completion, t_completion+700ms] при ЛЮБОМ исходе `checkForToolCalls` (успех и бросок); cue звучит; после 700мс → idle/listening; `state` никогда ≠ `error` из-за тула.
- **FAIL**: аватар остаётся listening/idle или прыгает в error при брошенном туле; cue не проигрывается; событие уходит ПОСЛЕ onDone (порядок в registry нарушен).

### Как проверять без node на Маке
- PC: юнит/интегра-тест на `registry.ts` wrapped.onDone порядок + ai-chat-ui `.catch`.
- Визуально (PC-dev браузер): консоль-лог `ASSISTANT_RESPONSE_COMPLETED` против `checkForToolCalls failed`; DOM-снимок `data-state` аватара в окно 700мс.

---

## §2 G2 verif — gesture-unlock (AudioContext resume по первому жесту)

### Сценарий (точный)
1. Загрузить страницу (до первого клика) — AudioContext у characterSoundManager ещё не создан / suspended (autoplay-policy).
2. Клик по любому месту / keypress (в т.ч. клик «Отправить» в чате) → регистрируется `unlockOnGesture`.
3. `unlock()` создаёт AudioContext и `resume()` если `suspended`.
4. Billy/Expert чат НЕ вызывает `unlock()` сам (G2-fix) — разблокировка только жестом.
5. После жеста ответ чата проигрывает cue (ctx.state === 'running').

### Якоря (file:line)
- `src/character/sound/CharacterSoundManager.ts:43-58` — `init()`: регистрация `pointerdown`/`keydown` → `unlockOnGesture` (line 47-51), self-remove (49-50). Комментарий G2-fix line 44.
- `src/character/sound/CharacterSoundManager.ts:62-69` — `unlock()`: lazy create AC, `resume()` если suspended.
- Подтверждение что чат НЕ зовёт unlock: grep `characterSoundManager.unlock` — единственный вызов внутри `init` (gesture), внешних вызовов из ai-chat-ui НЕТ (проверено: `unlock` упоминается только в CharacterSoundManager + scroll-lock unrelated).
- `src/js/ui/ai-chat-ui.ts:66` — `characterSoundManager.unlock()` отсутствует; есть только `unlockScroll` (line 6, 246) — НЕ путать.

### PASS / FAIL
- **PASS**: ДО первого жеста `ctx` отсутствует или suspended; ПОСЛЕ первого pointerdown/keydown — `ctx.state === 'running'`; cue звучит на завершении чата; чат не вызывает unlock напрямую.
- **FAIL**: cue тишина после ответа (ctx suspended); unlock вызван из ai-chat-ui; жест не снимает блокировку.

---

## §3 M1 parity re-check plan (ПК-инфра, гонит PC)

Контекст: M1=M007:REWORK был по ПК-инфра, не по коду Мака. Нужно подтвердить, что текущий src собирается/тестится ЧИСТО на обоих движках.

### Команды (на PC, где есть node)
```
# 1. Typecheck baseline (ожидание: 0 ошибок; исторический baseline ~313 файлов тип-проверки OK)
npm run typecheck            # tsc --noEmit  (package.json:20)

# 2. Unit/integration (ожидание: 769 тестов PASS, 0 fail)
npm test                     # vitest run   (package.json:19)

# 3. Bridge parity gates (опц.) — V007 ожидает clean
npm run verify:ci            # verify:events + verify:parity (package.json:22-24)

# 4. Билды v2 И v3 (оба PASS)
VITE_ENGINE=v2 npm run build # vite build + cp js dist/js (package.json:17)
VITE_ENGINE=v3 npm run build
```

### Что ожидать (от V007)
- `tsc --noEmit`: чисто, 0 диагностик (baseline-число 313 — кол-во тип-проверенных файлов/диагностик из пред. прогона, не блокирует если 0 errors).
- `vitest`: **769** тестов PASS.
- `VITE_ENGINE=v2` и `=v3`: оба билда завершаются успешно (vite build без ошибок, копия `js` в dist). Выбор движка: `import.meta.env.VITE_ENGINE ?? 'v2'` (якоря: `src/main.tsx:274`, `src/App.tsx:93`, `src/takes/takes.recorder.ts:70`, `src/components/MixerPanel.tsx:139` и др.).
- v2 = `src/audio/core/AudioEngineV2.ts`; v3 = `src/audio/engine-v3/*` (V2Adapter, TransportV3) — оба должны компилироваться и пройти тесты в едином билде.

### Кто гонит
- **PC** (sshfs-монтированный репо, там есть node + npm). Мак только верифицирует визуал в браузере PC-dev и поставляет этот протокол. Результаты (tsc/vitest/build логи) возвращаются в V007.

---

## §4 Frozen-check (НЕ трогать)

Зона запрета для любых правок по этой задаче (design-only подтверждение):
- `src/audio/engine-v2/*` и `src/audio/core/AudioEngineV2.ts` — **frozen**; публичный контракт `src/audio/engine-v3/IV2PublicContract.ts`. Character-AI НЕ должен менять поля/методы AudioEngineV2.
- `src/audio/bridges/*` и любые поля/методы с префиксом `_` (приватные мосты) — НЕ трогать.
- `CharacterSoundManager` **намеренно standalone** («мимо frozen AudioEngineV2», `src/character/sound/CharacterSoundManager.ts:2`): звук персонажа живёт только на `aiHub` + WebAudio, не через bridges/engine-v2. Это сохранить.
- `avatar.store.ts` поле `error` (`AvatarStateId`, line 6) существует, но G1/G2 его НЕ используют для тула — не добавлять ветку error в onCompleted.

✅ Frozen-статус подтверждён: якоря G1/G2 лежат вне frozen-зон (avatar/*, character/sound/*, js/ui/ai-chat-ui.ts, js/ai/registry.ts).

---

## §5 Verify-итог — чек-лист для V007 на PC-dev

- [ ] **G1**: `registry.ts:115` диспатчит событие ДО `callbacks.onDone` (line 118) — порядок сохранён.
- [ ] **G1**: `ai-chat-ui.ts:111` `.catch(non-fatal)` — ошибка тула НЕ пробрасывается; аватар happy удержан 700мс (`FullAvatar.tsx:132-140` / `FallbackAvatar.tsx:84-92`).
- [ ] **G1**: cue звучит (`CharacterSoundManager.ts:55,74`); контракт CUE_DEFAULT §4 (`20-25`).
- [ ] **G2**: `CharacterSoundManager.ts:43-58` gesture-unlock зарегистрирован; `unlock()` resume (`62-69`); чат НЕ зовёт unlock напрямую.
- [ ] **M1**: `npm run typecheck` → 0 ошибок (baseline ~313 OK).
- [ ] **M1**: `npm test` → **769** PASS.
- [ ] **M1**: `VITE_ENGINE=v2 npm run build` PASS; `VITE_ENGINE=v3 npm run build` PASS.
- [ ] **M1**: `npm run verify:ci` clean (events + parity).
- [ ] **Frozen**: `audio/engine-v2`, `audio/core/AudioEngineV2.ts`, `audio/bridges`, `_`-поля НЕ изменены; CharacterSoundManager standalone сохранён.

> НЕ коммитить. Только design/spec. Действия V007: сверить якоря на PC-dev, прогнать §3 команды, вернуть логи в V007.
