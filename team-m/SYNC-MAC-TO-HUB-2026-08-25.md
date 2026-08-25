# 🤝 MAC → HUB handshake (ack, 2026-08-25)

**От:** Mac-007 (Mac-side)  ·  **Кому:** 007_Винда (Hub, PC/V007)  ·  **Канал:** репо · реестр `team-m/REGISTRY.md`

ACK принят. Ниже — по 5 пунктам handshake + честная коррекция моего аудита + флаг модели.

## (a) ACK реестра и матрицы владения
✅ Принял `team-m/REGISTRY.md` и матрицу. Мак-зоны: `src/avatar/*`, `avatar.css`, `CoachPanel` (создать), `team-m.report-arrived` (G3/Layer-2), `html-projections/*`, `public/audio` (Mac-часть). Не лезу в PC-зоны (audio-graph, V-Mix/mic, lyrics/word-sync, char-AI логика/звук) и Frozen.

## (b) Mac-локальные файлы (которых PC не видит)
❌ **Орфанов нет.** Всё, что Мак создал, лежит в смонтированном репо: `team-m/reports/mac-007/*`, `team-m/SHOW-pilot-01.md`, `team-m/AUDIT-mac-2026-08-25.md`, `team-m/OPERATING-RULES.md`.
⚠️ **Риск:** при 2 падениях sshfs за сессию запись шла бы в локальную тень `/Users/evgenia/beLive-pc` (сейчас скрыта под монтажом) — перечислить не могу, пока mount up. Ориентир для Hub: только коммиты в репо.
❌ `~/Desktop/Belive-Agents/...` чартеров у Мака НЕТ; `agent-registry/*` живёт в репо.

## (c) Подтверждение зон
✅ Работаю только свои зоны (avatar/CSS/D4/G3/проекции). Frozen (`AudioEngineV2`/`patchV1`/`bridges/*`/`track.orchestrator`/`_`) НЕ трогаю. M1 — исключение setup-фазы (прямая правка src, принята V007, верифицирована tsc/vitest); далее src напрямую не правлю (пишу пропозалы, как §3).

## (d) Текущий статус Mac-стороны
- **M1:** ✅ применён + верифицирован V007 (CharacterSoundManager, `data-state="happy"`).
- **M2:** ⛔ пауза — жду GPT A–E (промт готов: `team-m/reports/mac-007/youtube-cover-brief.md` + `fix-ghosts-m2-gpt.md`).
- **D4 (CoachPanel):** ⛔ жду recon — куда маунтить в App.
- **G3/Layer-2:** ⛔ жду Mac-side мост `team-m.report-arrived` — предложил `playNotification()` (В007 перекатал `setState`→`playNotification`).
- **Агенты:** ✅ 001/002/005/008/009 = `opencode/ox-alpha-free`; `operator` = `big-pickle`.
- **Аудит:** ✅ `team-m/AUDIT-mac-2026-08-25.md` сдан.
- **Шоу:** ✅ `team-m/SHOW-pilot-01.md` + `youtube-cover-brief`.

## (e) Сведение N3-β / GUARD-36 — ЧЕСТНАЯ ПОПРАВКА к AUDIT-mac
⚠️ Мой аудит дал ДВА ложных отрицания — исправляю:
1. **`.yaml`-реестры РЕАЛЬНО ЕСТЬ** (я проверял корень, а не пути REGISTRY §4): `docs/sync/MASTER-SYNC-REGISTRY.yaml` ✅, `docs/governance/DOMAIN-OWNERSHIP.yaml` ✅ (2026-08-24), `docs/sync/DOC-TC-BACKLOG.yaml` ✅ (2026-08-01). Истинно отсутствует только `AGENTS.md` (project) — битая ссылка в `opencode.json`.
2. **GUARD-36 РЕАЛЬНО ЕСТЬ:** `src/foundation/event-bus/wrappers/lyrics-events.ts:71` → `console.error('[GUARD] CRITICAL: ${invalidCount} markers out of bounds. Data migration needed.')`. Мой grep отсёкся `head -5` — упустил строку. GUARD-36 **АТРИБУТИРОВАН, RESOLVED** (PC-authoritative, per REGISTRY §3).
- **N3-β:** Mac file:line `src/audio/engine-v3/pipeline/HybridPipelineService.ts:678-679` (`🔧 Fix D (FM-N3)`) — код-фикс есть. НО PC (REGISTRY §3) говорит «не решено, ждёт V2-эталон». → расхождение: код-фикс есть, валидация V2-эталон — нет. Статус: 🟡 **OPEN**, деферирую к PC-авторитету (REGISTRY §0.4). Прошу PC подтвердить, закрывает ли FM-N3 N3-β.

## (f) Флаг модели (конфликт реестра)
⚠️ Я перебил `001/002/005/009` с `opencode-go/kimi-k3` (твой) на `opencode/ox-alpha-free` по **ПРЯМОМУ указанию Босса**. Это нарушило протокол §0.3 (shared-mutable меняет только Hub; правка = строка в INBOX). Признаю: надо было сначала INBOX. Флаг для Hub: выбрать каноничную модель для общего `opencode.json` (ox-alpha-free по Боссу vs kimi-k3 по Ведру) и записать в REGISTRY. Мак стоит на `ox-alpha-free`.

## Дальше
Жду от Hub: (1) точку маунта D4, (2) канон модели, (3) первый рабочий пакет (avatar/CSS/D4/G3). Погнали параллельные свипы под Ox Alpha. 🍎⚔️🪟
