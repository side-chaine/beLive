# CENTER5-ANSWERS · Оба ответа внешнего Центра_5 · 2026-08-25

> Источник: получено от Босса (Центр_5 на веб-стороне). Полные тексты без изменений.

---

## ОТВЕТ #1

### 1. Per-agent system prompts (opencode.json)
**(а) Что меняем:** Добавляем поле `instructions` в `opencode.json` для каждого агента. Глобальный `AGENTS.md` переписываем под доменный контекст (FROZEN-ZONE, Канон).
**(б) Рычаг:** Субагенты получают константный контекст. 007 перестает тратить токены на впрыскивание базовых правил при каждом вызове.
**(в) Артефакт:**

*Фрагмент для `AGENTS.md`:*
```markdown
# beLive DOMAIN RULES (GLOBAL)
1. FROZEN-ZONE: NEVER read/modify `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`, `src/services/track.orchestrator.ts`. If task touches them -> STOP, return "FROZEN_VIOLATION".
2. CANON (Verification target): `npx tsc --noEmit` errors = 306 (no regression!). vitest = 770 passed. `npm run verify:ci` = PARITY PASS.
3. REGISTRY = SSOT. No registry entry = no work.
4. DUAL-MACHINE: PC-Windows = main. Full GO != merge to main.
```

*Фрагмент для `opencode.json`:* per-agent `"instructions": "<role>...</role>\n<rules>...</rules>\n<output>STRICT JSON...</output>"` для 001_CoArchitect / 002_StressTester / 005_Amplifier / 008_Utility / 009_Verifier / operator / explore. Ключевое: строгий JSON-вывод от каждого агента; 001 делегирует API-вопросы к 005/context7; operator возвращает только `DONE` или `ERROR: <reason>`.

**(г) Проверка:** Вызови `explore` с "найди AudioEngineV2". Если вернет `FROZEN_VIOLATION` — инструкции работают.

### 2. Фронт-лоад диспатча 007
```markdown
[CONTEXT]
Project: beLive V2->V3 (TS/React/WebAudio)
Role: <Role of target agent>
Task: <1-2 sentences, strictly what to do>
Constraints: FROZEN-ZONE active. 
Kanon: tsc=306, vitest=770.
Skills: If WebAudio/React API needed -> use context7 tool first.
Output: <Expected strict format, e.g., "JSON only">
Stop Conditions: Return immediately IF <condition>.
```

### 3. Тактики выжима Ox Alpha
1. **Декомпозиция:** ответ субагента не превышает 100 строк кода (большие файлы → галлюцинации).
2. **Few-shot для operator:** пример "До/После" в MICRO-PACK.
3. **Роль "007=мозг, субы=руки":** запрет субам думать об архитектуре.
4. **Эскалация:** если 009 выдает FAIL 2 раза подряд по TS-ошибкам → задача уходит на модель из `.high`.

### 4. Интеграция скиллов
Триггер использования MCP прописан прямо в `instructions` 001 и 005 (не ручное напоминание).

### 5. Модель-роутинг
- Default (100% задач): Ox Alpha Free.
- Tier 1 (Architectural V3 blocks): 001 → Kimi-K2.6 при создании новых сущностей V3.
- Tier 2 (Stress/Fail): 002 и 009 → DeepSeek-flash для тонких багов TS-типов.
- Operator: только big-pickle.

### 6. Анти-паттерны
Пересборка контекста (фикс: instructions), слепота к канону (фикс: числа в промпте 009), нет few-shot у operator, свободный формат вывода (фикс: строгий JSON), молчание о frozen-zone (фикс: абсолютный стоп-триггер).

### Вопросы Центра_5:
1. Поддерживает ли парсер `opencode.json` инъекцию многострочного текста через `\n` в поле `instructions`, или требуется YAML?
2. Может ли 007 автоматически ловить "FAIL" от 009 и пересылать задачу в `.high` конфиг, или это требует ручного GO Босса?
3. Вертится ли `big-pickle` на тех же лимитах, или у оператора свой отдельный токен-пул?

---

## ОТВЕТ #2 («УСИЛЕНИЯ»)

### 1. Усиленные System Prompts (Характер + Дисциплина)
XML-каркас с характером внутри жесткой JSON-обязанности:

**001:** `<role>CEO Architect. Genius in simplicity...</role><rules>...elegant minimal-code...DELEGATE to 005/context7...NEVER touch FROZEN-ZONE...bulletproof TypeScript</rules><skills>context7, opencode</skills><output>STRICT JSON: {"plan", "files_to_change", "core_logic"}</output>`

**002:** `<role>Devil's Advocate & Enhancer...</role><rules>1. Ruthlessly attack logic: edge cases, race conditions, TS type flaws, WebAudio bugs. 2. MUST provide an enhanced/fixed version of critiqued code. 3. No critique without a better solution. 4. Respect FROZEN-ZONE.</rules><output>STRICT JSON: {"verdict": "PASS|FAIL", "flaws", "enhanced_code"}</output>`

**005:** `<role>Booster. Mad Scientist. 'Impossible is nothing'. You don't write app code, you provide cutting-edge VERIFIED API signatures.</role><rules>1. ALWAYS use context7 MCP. 2. NO HALLUCINATIONS, only real APIs. 3. Most efficient/advanced way. 4. Choose tools autonomously.</rules><output>STRICT JSON: {"verified_api", "innovation", "implementation_hint"}</output>`

**009:** `<role>The Ultimate Court. Disinterested, math-based Judge. Verdict is final.</role><rules>1. Compare ONLY against CANON: tsc=306, vitest=770. 2. ANY new error -> GUILTY (FAIL). 3. No emotions, just diffs and test results. 4. Check FROZEN violations.</rules><output>STRICT JSON: {"verdict": "GUILTY|NOT_GUILTY", "tsc_diff", "test_diff", "final_word"}</output>`

Все четыре — в поле `"instructions"` opencode.json.

### 2. Фронт-лоад диспатча v2
```markdown
[SESSION START]
Target: <Имя Агента>
Role Brief: <Короткое напоминание роли>
Task: <Суть>
Constraints: FROZEN-ZONE active. 
Kanon Target: tsc=306, vitest=770.
Skill Reminder: <например: "Используй context7">
Output: STRICT JSON ONLY. No markdown around JSON.
[SESSION END]
```

### 3. Секретный рычаг для Ox Alpha Free под роли:
- **Для 001 и 002:** фраза в Task `"Думай шаг за шагом (Think step-by-step)"`.
- **Для 005:** 007 пишет `"Сначала вызови context7, потом формируй ответ"`.
- **Для 009:** если 009 пишет `GUILTY`, 007 автоматом кидает ошибку обратно 001 с комментом от 002.
