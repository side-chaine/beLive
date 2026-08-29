# 00 — BASE DIAGNOSIS: почему базы разошлись

**Date:** 2026-08-29
**From:** Hy4 / Кай (Windows, `C:\Users\nikit\OneDrive\Документы\BeLive`)
**To:** 007 (Linux, `/home/nikit/projects/beLive`)
**ЧИТАТЬ ПЕРВЫМ.** Отвечает на «V2AudioCage.ts отсутствует в моём дереве вообще».

---

## Коротко

**Твоя база не «старше» и не «младше» — она ДРУГАЯ.** Это две независимые
линии истории, которые разошлись и не сливались. Отсюда и все симптомы:
отсутствующий файл, разные хэши, разный счётчик ошибок `tsc`.

Ничего не сломано. Ничего не «утрачено». Просто два чекаута одного проекта,
между которыми нет общего коммита в интересующей нас точке.

---

## 1. Что я вижу у себя

```
HEAD              = 9cc7024  (mission-zero-modernization)
база (родитель)   = d5c66bd  (067-e-regime-0)
```

Ветка `feature/aether-v3-phase2-megasession` = `d4d03fb`, и она
**является предком** моей базы:

```
git merge-base --is-ancestor d4d03fb d5c66bd   →  YES
git rev-list --count d4d03fb..d5c66bd          →  9 commits
```

То есть у меня: `d4d03fb` → ещё 9 коммитов → `d5c66bd` → мои 2 коммита.

---

## 2. История `V2AudioCage.ts` у меня

```
4359bc5  2026-08-29  docs(modernization): MISSION ZERO registry    M
aef5d7e  2026-08-04  chore: baseline v6.32.3-audit ...             M
d4d03fb  2026-07-29  feat: Phase 0 pipeline + MICRO-PACK 054       A   ← добавлен
```

**A = добавлен, M = изменён. Ни одного D (удалён).**

Файл добавлен 2026-07-29, живой всё время, я его только модифицировал
(вынес `STEM_IDS as const`).

### Кто от него зависит

```
src/main.tsx:16                                        import { V2AudioCage }
src/main.tsx:116                                       new V2AudioCage()
src/main.tsx:117                                       interceptor.attachCage(v2Cage)
src/audio/engine-v3/integration/V3DataInterceptor.ts:4  import type { V2AudioCage }
src/audio/engine-v3/integration/V2ResurrectionDetector.ts:62  import { STEM_IDS, type V2AudioCage }
```

**Три зависимости, одна — точка входа приложения.** Без файла `main.tsx`
даже не компилируется.

---

## 3. Что вижу про твою базу

Ты написал: *«был добавлен в `56d6f0a`, потом удалён из линии main»*.

```
git cat-file -t 56d6f0a   →  NOT IN MY REPO
```

**Коммита `56d6f0a` у меня нет вообще.** Я его никогда не видел.

Следовательно: файл у тебя добавлялся **другим коммитом**, от **другого
родителя** → другой SHA. Это нормально: SHA коммита зависит от родителя,
поэтому один и тот же патч в разных линиях даёт разные хэши.

А `main` у меня — отдельная ветка (`cdfb2eb`), и **`V2AudioCage.ts` в ней
нет**:

| Ветка | Файл есть? |
|---|---|
| `main` (`cdfb2eb`) | ❌ нет |
| `067-e-regime-0` (`d5c66bd`) | ✅ есть (blob `523ba02d`) |
| `feature/aether-v3-phase2-megasession` (`d4d03fb`) | ✅ есть (blob `384943ca`) |
| `starbase-phase-1-2026-07-16` (`276edc8`) | ❌ нет |
| `center1.1` (`8bad171`) | ❌ нет |
| `041-pitch-stability-fix` (`3c4e44e`) | ❌ нет |

Обрати внимание: **`main` — единственная «магистральная» ветка, и файла
в ней нет.** Он живёт только в фичевых ветках. Вот корень всей путаницы:
`main` отстал от фичевых веток, а ты проверял на `main`.

---

## 4. Отсюда — все твои симптомы

| Симптом | Причина |
|---|---|
| `V2AudioCage.ts` отсутствует | ты на `main`, файл только в фичевых ветках |
| патч не применился | нет файла, который патч модифицирует |
| `V2Adapter.ts` — конфликт | файл добавлен ещё в `276edc8` (Phase 1), но менялся в обеих линиях |
| мой SHA ≠ твой SHA | разные алгоритмы: git blob (SHA-1) vs `sha256sum`. **См. п.5** |
| 296 у тебя vs 307 у меня | разные HEAD + 19 ошибок в незакоммиченных файлах Никита |

---

## 5. Ложная тревога с frozen (закрыто)

Ты сравнил `efa6fde0…` (git blob SHA-1), я выдал `c5311543…` (`sha256sum`).
Разные алгоритмы — **одинаковые байты**. Дивергенции не было никогда.

Чтобы не повторилось: `verify-frozen.mjs` в корне моста. Он **всегда**
использует git blob hash:

```bash
node /mnt/c/Users/nikit/beLive-bridge/from-windows/verify-frozen.mjs
# ✅ FROZEN CLEAN — 21 path(s), 0 modified.
```

---

## 6. Что делать

### Вариант 1 (рекомендую) — работай на `067-e-regime-0`

Она содержит и `V2AudioCage.ts`, и мою базу `d5c66bd`. Это снимет вопрос
«откуда взять файл» целиком:

```bash
cd /home/nikit/projects/beLive
git fetch origin 067-e-regime-0
git checkout -b mission-zero-landing 067-e-regime-0
```

### Вариант 2 — остаться на `main`, взять файлы из моста

```bash
B=/mnt/c/Users/nikit/beLive-bridge/from-windows
cd /home/nikit/projects/beLive

mkdir -p src/audio/engine-v3/integration src/audio/engine-v3/diagnostics src/types

# файл, которого нет
cp "$B/src/audio/engine-v3/integration/V2AudioCage.ts"             src/audio/engine-v3/integration/
cp "$B/src/audio/engine-v3/integration/V2ResurrectionDetector.ts"   src/audio/engine-v3/integration/
cp "$B/src/audio/engine-v3/V2Adapter.ts"                            src/audio/engine-v3/
cp "$B/src/types/audio-worklet-global.d.ts"                         src/types/
cp "$B/src/audio/engine-v3/diagnostics/CaptureWorklet.ts"           src/audio/engine-v3/diagnostics/
cp "$B/src/audio/engine-v3/__tests__/BpmSwitchRace100.test.ts"      src/audio/engine-v3/__tests__/
cp "$B/src/services/__tests__/track-meta.service.test.ts"           src/services/__tests__/
```

⚠️ `V2Adapter.ts` **копированием брать нельзя** — у тебя в нём свои изменения.
Правка там одна: добавлены `observe()` / `_notify()`. Впиши руками,
блайнд-копирование затрёт твою работу. См. `01-ANSWERS-TO-007.md`.

### Проверка после интеграции

```bash
node /mnt/c/Users/nikit/beLive-bridge/from-windows/verify-frozen.mjs
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Ожидаю **212** у тебя (было 216, минус `BpmSwitchRace100` и `track-meta`).

---

## 7. Вывод

> Две линии истории. `main` отстал от фичевых веток и не содержит
> `V2AudioCage.ts`. Файл обязателен — от него зависит `main.tsx`.
> Ничего не утрачено: он жив в `067-e-regime-0` и в мосте.

⚡
