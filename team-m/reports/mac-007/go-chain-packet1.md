---
agent: mac-007
task: go-chain-packet1
status: done
updated: 2026-08-25T07:30:00+00:00
---
# GO_001 (inline) — Packet-1: D4 CoachPanel + G3 NotifyBridge

**Режим:** цепочка исполнена ИНЛАЙН ролями 001→002→001→009 (спавн именных сабагентов временно невозможен: у процесса закэширован конфиг со старой моделью; фикс в `~/.config/opencode/opencode.jsonc` применён, вступит после следующего рестарта процесса).

## A (001): решение
- `src/js/stores/coachPanel.store.ts` — zustand `{open,setOpen}`.
- `src/js/ui/CoachPanel.tsx` — каркас панели.
- `App.tsx:253` после `<BillyDock/>`: `{coachPanelOpen && <CoachPanel onClose={...}/>}`.
- `src/character/notify-bridge.ts` — fetch HEAD `/team-m/INBOX.md` (Last-Modified/etag) → диспатч `team-m.report-arrived`; проводка через `registerInit`.
Полные диффы — в истории сессии / предыдущих пропозалах (`proposal-coachpanel.md`, `proposal-notify-bridge.md`).

## C (002): атака
1. ⚠️ HMR-утечка setInterval → гард повторного init (`started`).
2. ⚠️ Fallback GET+etag, если HEAD-заголовки пустые.
3. ✅ Frozen-Zone чист; R9 ок; контракт события ок. БЛОКЕРОВ НЕТ.

## A2 (001): правки
Гард `if (started) return; started = true;` внутри init; fallback GET при отсутствии заголовков. Остальное без изменений.

## Вердикт (009): **GO**
Минимально, безопасно, готово к dispatch Оператору (Hub).

## Инфраструктурные находки (важно для Hub)
1. **Модель `opencode/ox-alpha-free` НЕ существует** (`opencode models`: hy3-free, mimo-v2.5-free, muse-spark-1.2-contributor-free, nemotron-*-free, x-preview-f-free). Реальная модель сессии 007 = `opencode/x-preview-f-free`. Все конфиги (репо+глобал) надо перевести на неё — иначе спавн падает `Model not found`. У Ведра в репо-конфиге та же мина (+ 008=mimo, explore/general отсутствуют).
2. Корень «почему не работали субагенты»: сессия Мака стартовала из `/Users/evgenia` → репо-конфиг не читался вовсе; исправлено записью канона в глобал `~/.config/opencode/opencode.jsonc` (работает из любой директории).
3. После следующего рестарта процесса именной спавн `Task 001/002/…` заработает на x-preview-f-free.
