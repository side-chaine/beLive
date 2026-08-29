# MAC-FRONT-DIGEST · 2026-08-29 · для 007 (Linux / Far Light hub)
## БАЗА: HEAD a691c2f · дата 29.08 · канон-снапшоты: prod-push 780db23, тег v2-final-production = cdfb2eb

> ИСТОЧНИКИ: `git` (HEAD ancestry), `team-m/REGISTRY.md` (строки 319-325, 35), `team-m/bLb/*`, `team-m/INBOX.md`, `team-m/design-refs/*`, мост `/mnt/c/Users/nikit/beLive-bridge/{from,to}-windows/`.
> ВАЖНО (верификация): все 58 коммитов 28-29.08 в ancestry HEAD автор = `mac-007@belive.local`. Разделение «Мак» vs «007-Linux» — по СУТИ коммита (город/bLb/волны миграции/фиксы = Мак; security/registry/токены/брифинг/prod-push/MIGRATION-STORY = 007-Linux), НЕ по git-author.
> АНОМАЛИЯ ПОИСКА: `git log --since="2026-08-28"` отдаёт только 9 коммитов (все 007-Linux), ПРОПУСКАЯ 19 городских/миграционных коммитов Мака (их committer-date тоже 08-28, но не вошли в выдачу — см. ниже «Мак (город)»). Именно поэтому у 007 (глубокий перебор по author-date+DAG) картина свежее, чем у Hy4 (полагается на тот же `--since`).

---

## 1. Коммиты 28-29.08 (SHA + суть)

Всего в ancestry HEAD за 28-29.08: **58 коммитов**. Ниже — город/bLb-фронт Мака (фокус диспатча) и полный список 007-Linux. Остальные ~38 коммитов Мака (волны миграции W3→W6, SPA-fallback, feed-bot/catalog-фиксы, Qwen-синки, prod-auth/worklet) сведены в конце раздела.

### МАК — город / bLb (фокус)
**ИЗВЕСТНЫ (из диспатча, 6 шт, до 5090d9e):**
- `176fbd7` (08-28 12:59) sync MAC→HUB city-prep findings W4/W5: Rehearsal держится за V2 (36 `window.audioEngine`), engine-v3 безопасный снос, мусор, secrets hygiene.
- `cd37f2c` (08-28 13:04) city: Track C — REPO-TO-CITY MIGRATION PLAN DRAFT v1 + houses.yaml DRAFT v0.
- `88da302` (08-28 13:12) city: решения Босса 28.08 — ownership default center/007, Karaoke/Concert планируемые, Rehearsal-first, Gate S отложен.
- `e30c495` (08-28 13:15) docs Track B — фикс дрифтов D1/D9/D12/D13, SUPERSEDED-баннеры, character-layer паспорт.
- `be28003` (08-28 13:53) city: MVP-1 скелет — bLb-SNAPSHOT.html (изометрия) + city-state.json + city-gen.mjs (houses.yaml→map, run on PC).
- `5090d9e` (08-28 13:59) city: design brief для внешних архитекторов Centers (арт-конкурс на beLiveBase-стиль).

**НОВЫЕ ПОСЛЕ 5090d9e (9 шт, ОБНАРУЖЕНЫ 007; опровергают миниатюру «новых Мак-коммитов НЕТ»):**
- `e826b96` (08-28 14:29) baseline pre-W4 tails (Boss GO 28.08): ai M4-unify+Character-AI tails, prebuild hook, архивация team-m, промпты Qwen, REGISTRY SSOT catch-up (city commits, closure v2), opencode.json untracked.
- `7a71e09` (08-28 14:41) city: data pack для Center_6 (Opus) — houses.yaml full, git-metrics CSV, EventBus-граф, brand-glow, статусы.
- `fb8f291` (08-28 14:58) city: ответ Opus block-7 — полный рендер-код, честность позиций/высот, VMO-нумерация, W4/W5+BAC-107.
- `64ad8ae` (08-28 15:00) city: grid_x/grid_y перенесены в houses.yaml (Opus CRITICAL 7.2) — позиции data-driven.
- `a74d3b4` (08-28 16:58) city: mega-prompt для GLM 5.3 (Center_6) — задача + Opus-критика + data pack + Gemini Night Stage как база.
- `780db23` (08-28 17:44) city: **GLM v0.2 quiet city утверждён Боссом как база** — whisper/hover, interiors, tour chain, beLiveBase API. *(это и есть последняя выкачка в прод)*
- `a3a6426` (08-28 18:03) **bLb: cadastre v0.2** — houses.yaml единый источник (what/gives/rooms, реальные loc/files 28.08, Karaoke/Concert split, гейты W5+rehearsal-prod); metro→EventBus v2 (28 событий, D14-дрифт 29↔28); city-gen v2 (валидация+инъекция); **city-metrics.mjs для ПК**; tour.yaml; CITY-PROTOCOL; city-journal.
- `bd9595f` (08-28 18:05) bLb: реальный кадастр вшит в quiet city (19 зданий, gates, tour из tour.yaml) + REGISTRY Mac-side Update #3 с PC-задачей (city-metrics→city-gen).
- `0dd77cc` (08-28 18:40) bLb: GLM iter-2 brief — Efir/YouTube mode, interiors 2.0, metro toggle, external+free lots; hard NOs (маркеры/data/API).
- `21c486a` (08-28 18:05) sync Mac→Hub bLb v0.2 cadastre handoff + PC task (city-metrics, city-gen).
- `9d33c7a` (08-28 18:06) sync: фикс пустого sync-файла (sshfs flush race) — полный bLb v0.2 handoff.

### 007-LINUX (security / registry / tokens / брифинг / prod-push / MIGRATION-STORY) — ПОЛНЫЙ СПИСОК (11 шт)
- `b047772` (08-28 18:02) docs(REGISTRY): S1 worklet-fix + prod-auth records; **V3 PROD PUSH record (тег v2-final-production, main cdfb2eb→780db23, CF+GH deploys verified, real OAuth)**; SECURITY debug-hmac RESOLVED.
- `50ceab2` (08-28 18:07) docs: MIGRATION-STORY-DVIGATEL — сценарная фактура YouTube-серии (7 эпизодов), упаковано 007 из отчётов скаутов.
- `39dc585` (08-28 23:47) fix(catalog): TG-DL-RETRY — retry на transient CDN-break + isTransient-тесты (chain 001→002→009→Operator, РЕШЕНО).
- `8748ad8` (08-29 07:29) fix(upload): LYRICS-JSON-DROP — читать data.lyrics из export.json + тесты.
- `78b19f4` (08-29 07:30) docs(registry): LYRICS-JSON-DROP RESOLVED; SECURITY deploy path = Dashboard (wrangler net-blocked) + MVSEP H1.
- `1dfb7b1` (08-29 19:04) security: purge MVSEP plaintext из DEPLOY.md (rotated; history scrub pending git-filter-repo).
- `bb159ba` (08-29 19:05) registry: MVSEP key purge status — working tree clean, history scrub blocked (tooling).
- `2bdad26` (08-29 19:06) hub: Mac city-audit briefing (SYNC + INBOX tasks) + audit artifacts + scripts.
- `7d165d1` (08-29 21:14) security: purge TG bot tokens из tree (AAF_ hardcoded→requireEnv; AAHW_ в docs→wrangler-secret) + Hy4 secrets package (check-secrets.mjs gate, full-sweep/remediation/visual-map docs).
- `58303a3` (08-29 21:48) registry: security-pivot status — 3 GOs, tree scrubbed+pushed, gate false-positive, scouts pending.
- `a691c2f` (08-29 21:48) **HEAD**: registry: mask live TG token в audit-note (был plaintext по ошибке).

### Прочие Мак-коммиты 28-29.08 (не город, но в том же окне; ~38 шт) — кратко
- Волны миграции (автор Мак, применял 007 через цепь): `02e3ac9` WAVE3 demolish V2-switch (8 gates GREEN), `3623882` restore __v3Active writer, `2766ddc` WAVE4 track.loader SAFE-copy, `18cb248` WAVE5 demolish dead stubs + Block Editor migrate, `8f0b3ad` WAVE6 waveformEditor hygiene → migration V2→V3 FINISHED (`b3a23dc`).
- SPA-fallback / prod: `0e85789` SPA-fallback MIME crash fix, `162f94d` model-switch agents, `233a455` D2-smoke PASSED, `870adea` V2-TEST-CLEANUP (canon 761+0int), `1ad9bb9` prod-auth .env.production real OAuth, `7a1f4f8` S1+D1+D2 Signalsmith worklet via static public/vendor.
- feed-bot/catalog: `6ef20eb` expose full catalog /tracks + CORS, `446aed0` artist in TG search, `e99000e` /tracks unions track_data, `d0ec609` rotate BOT_TOKEN.
- Синки Qwen/connection: `88e259d`, `f8c8b86`, `ce4c6a7`, `d859456`, `d16bbaf`, `52f1f41` (closure M3-GO), `7de7bd9`, `a7aab6a`, `69970dc`, `e61ee6e`, `2556535`, `1a41187`, `0aa87a3`.

---

## 2. Город bLb — состояние (файл → статус)

`team-m/bLb/` (все файлы датированы 08-29 18:45 в рабочем дереве; источник версий — REGISTRY:319-325 и `git log -- team-m/bLb`):
- **houses.yaml v0.2** (`a3a6426`) ✅ — ЕДИНЫЙ источник кадастра: **19 зданий** + метро + внешние; what/gives/rooms (простыми словами); **реальные loc/files замерены 28.08** (Live=126, Academy=10665, Studio=21199); Karaoke/Concert = два отдельных планируемых здания; гейты фаз W5+rehearsal-prod в meta.gates. [REGISTRY:320]
- **city-gen.mjs v2** (`a3a6426`) ✅ ПРОГНАН Маком через JSC: **0 ошибок, 19 зданий, 7 кварталов, 14 линий, тур 9 остановок**. Парсер секций + валидация контракта (exit 1 при нарушении) + инъекция CITY/TOUR в HTML. [REGISTRY:322] — это подтверждает строку миниатюры «city-gen.mjs v2 — прогнан Маком JSC 0 ошибок».
- **bLb-CITY-v0.2-quiet.html** (`780db23` + патчи) ✅ — тихий город GLM сохранён как рендер-слой; патчи Мака: честная камера flyTo(viewK), шёпот кварталов, gate-aware действия + двойное подтверждение сноса, exportCadastre()/journal() API, t30=-1 = «считается на ПК». [REGISTRY:319]
- **tour.yaml** ✅ — YouTube-тур как данные: **9 остановок + финальный CTA-кадр**. [REGISTRY:323]
- **CITY-PROTOCOL-2026-08-28.md** ✅ есть (контракт слоёв/write-back/гейтов). [REGISTRY:323]
- **city-journal.yaml** ✅ есть (аудит действий пульта; 3 записи: boss city mvp1→v0.2-quiet; mac arenas karaoke+concert; mac city glm-cadastre→houses.yaml v0.2, «t30 ждёт city-metrics.mjs на ПК»). [REGISTRY:323]
- **city-state.json** ✅ (из be28003 MVP-1 skeleton).
- **city-metrics.mjs** ⏳ скрипт готов (`a3a6426`), НО **НЕ ПРОГНАН**: `team-m/bLb/city-metrics.json` ОТСУТСТВУЕТ → **ЗАДАЧА ПК НЕ ВЫПОЛНЕНА**. План: `node city-metrics.mjs` (loc/files/t30→city-metrics.json), затем `node city-gen.mjs` (пересборка с реальной активностью); оба read-only к src. [REGISTRY:324]
- **bLb-SNAPSHOT.html** — MVP-1 скелет (be28003), вытеснен v0.2-quiet как база. [git: be28003]
- **design-refs / CITY-DATA-PACK / CITY-MEGA-PROMPT / CITY-ANSWER-OPUS-BLOCK7 / DESIGN-BRIEF-CITY / BRIEF-GLM-ITER2** — всё присутствует в `team-m/bLb/` (материалы для Center_6 / GLM итераций).
- **frozen-guard.mjs / boot-smoke.mjs** — guard-тулинг на месте.
- **Известные дыры маппинга** (city-gen warnings, не ошибки): темы/пресеты (нет события в шине), питч (legacy main.js вне шины), **5 зданий без линий** (styles/karaoke/concert/profile/aiconfig). [REGISTRY:325]

---

## 3. Мак-отчёты / письма (тема → выжимка 1 строка)

В `team-m/` от Мака (SYNC-MAC-TO-HUB-*, dated 28-29.08):
- `SYNC-MAC-TO-HUB-2026-08-28-blb-v0.2-cadastre.md` → bLb v0.2 кадастр: 19 зданий, metro=EventBus 28 событий (D14: в доке 29/в коде 28), city-gen v2 прогнан 0 ошибок, city-metrics.mjs готов, tour.yaml 9 остановок.
- `SYNC-MAC-TO-HUB-2026-08-28-city-prep-findings.md` → находки к городу для W4/W5: Rehearsal держится за V2 (36 `window.audioEngine`), engine-v3 снос безопасен, мусор+secrets hygiene.
- `SYNC-MAC-TO-HUB-2026-08-28-conn-confirmed.md` → связь жива, sshfs перемонтирован, src НЕ трогает, Qwen подтверждён живым тестом.
- `SYNC-MAC-TO-HUB-QWEN-RESOLVED-2026-08-28.md` → развязка Qwen 3.8 Max Free: модель в `.opencode/agent/*.md` перекрывает json; tokenrouter нужен `options.apiKey:{env}` + models-лист.
- (007→Mac, не Мак, но лежат в team-m/) `SYNC-HUB-TO-MAC-2026-08-29-city-audit.md` (19:06) и `SYNC-HUB-TO-MAC-2026-08-29-mission-zero.md` (16:14) — брифинги/задачи от 007 к Маку.

**INBOX.md — очередь mac-007 (последние ~10 строк, tail):**
`MICRO-PACK-E1-PREDICATE-draft`, `security-audit-pivot` (**GO 2026-08-29**), `city-description` (**GO 2026-08-29**), `proposal-coachpanel-body`, `ack-h-letter-d4-verified`, `recon-d4-g3`, `pitch-scope-chain`, `youtube-cover-brief`, `student-pedagog-worker-hunt`, `proposal-coachpanel`, `roadmap-master`, `proposal-notify-bridge`, `run3-m3-d3-d4`, `design-refs-analysis`, … _Всего отчётов: 63_. (Источник: `team-m/INBOX.md` tail, 29.08 19:05.)

---

## 4. Мост (from-windows → самое свежее; to-windows → что зеркалил 007)

Полный `ls` (имя + дата, мост только чтение):
**from-windows/ (что Hy4 принёс):**
- `00-ALERT.md` (29.08 23:19) ← **САМОЕ СВЕЖЕЕ**
- `07-HY4-INITIATIVES-SUMMARY.md` (29.08 23:18)
- `08-PITCH-COUNTERCHECK.md` (29.08 23:17)
- `00-BASE-DIAGNOSIS.md` (29.08 16:14), `01-ANSWERS-TO-007.md` (29.08 16:26), `02-ANSWERS-TO-007.md` (29.08 18:31), `03-bLb-BRIEFING.md` (29.08 19:42), `04-REQUEST-ALPHA-REPORT.md` (29.08 20:09), `05-VISUAL-MAP-TO-bLb.md` (29.08 20:29), `06-GPT-REFS-TO-BRIDGE.md` (29.08 20:29)
- `REPORT-TO-007-VISUAL-MAP-2026-08-26.md`, `VISUAL-MAP-ORIGINALS.md` (29.08 20:16)
- скрипты Hy4: `audit-city.mjs` (29.08 17:34), `check-secrets.mjs` (29.08 18:29), `check-manifest.mjs`, `check-native-bindings.mjs`, `check-sri.mjs`, `sync-bridge.mjs`, `verify-frozen.mjs`, `mock-align-server.mjs`
- бандлы: `mission-zero-handoff.tar.gz`, `mission-zero.bundle` (29.08 10:26)
- папки: `docs/` (ADR-0001..0016, MISSION-ZERO-REPO-SCAN, REGISTRY, ROADMAP, SRI-PATCH, findings/), `src/` (audio/services/types), `008-originals/` (VMO-001..040 PNG, 29.08 20:16)

**to-windows/ (что 007 зеркалил Hy4):**
- `BRIEF-HY4-LEGACY-REMOVAL-2026-08-29.md` (29.08 16:26)
- `SPLIT-CORRECTION-VIS2-2026-08-29.md` (29.08 22:43) ← самое свежее из to-windows
- папки: `audit/` (29.08 17:43), `docs/` (audit/, telegram/ — 29.08 21:48), `reports/007-vinda/` (29.08 22:43), `team-m/` (только REGISTRY.md, 29.08 21:48)

> САМОЕ СВЕЖЕЕ: from-windows = `00-ALERT.md` @ 29.08 23:19; to-windows = `SPLIT-CORRECTION-VIS2-2026-08-29.md` @ 29.08 22:43.

---

## 5. Design-refs (сколько, ключевые)

`team-m/design-refs/`: **19 PNG-референсов** (ChatGPT-генерация 24.08, ~28 МБ) + `CONTEXT.md` + `MANIFEST.md` = **21 файл**. PNG не в git (только MANIFEST — коммит-единица). [MANIFEST.md, CONTEXT.md]
Ключевые из отчёта 008 — ВСЕ ПРИСУТСТВУЮТ:
- `04-quest-ai-coach-chat.png` ⭐ (правый чат bL AI Coach, карточки Grammar/Pronunciation/Meaning + действия)
- `05-karaoke-practice-controls.png` (караоке: tempo LOW/MID/ORIGINAL, loop A-B, метроном)
- `11-live-masterclass-chat.png` (LIVE-мастер-класс, чат зрителей)
- `12-pitch-practice-billy-chat.png` ⭐ (чат Billy, карточка блока + pitch-график)
- `13-quest-planner-billy-cards.png` ⭐⭐ (квесты в чате, drag-планировщик)
- `17-catalog-dark-dna-terminal.png` (Track DNA терминал, A-P-B формула)
- `18-catalog-dark-dna-helix.png` (вариант 17 со спиралью)
Прочие: 01-03 studio-console (full/minimal/ai-assist), 06-10 split/pedagog/whiteboard/youtube/home, 14 home-dashboard, 15 youtube-thumb, 16 catalog-light-DNA, 19 fader-design-system.

---

## 6. BLB-5 пилот: готово/нет по 9 этажам (STUDIO 5 + SPLIT 4)

**В Linux-репо пилот BLB-5 НЕ ПРЕДСТАВЛЕН как 9 этажей/паспортов.** Проверено:
- `team-m/REGISTRY.md` — нет упоминаний «BLB-5», «5 этажей», «9 паспортов» (только F-1/F-2 пилот миграции,无关).
- `team-m/bLb/houses.yaml` — здания `studio` (id 003-005, 3 rooms: Движок v3 / Ядро v2 / Стемы) и `split` (id 011, Башня Split) описаны как ОБЪЕКТЫ с rooms, НЕ как «5 этажей studio + 4 этажа split». Детализации по 9 этажам нет.
- **`team-m/bLb/BUILDING.md` ОТСУТСТВУЕТ** (проверено: `ls` → no such file).
- Поиск «BLB-5 / 9 паспорт / STUDIO 5 / SPLIT 4 / 5 этаж / 4 этаж» по `team-m/` → только упоминание «паспорт» в контексте паспорта здания/трека (не 9 этажей).

**Вывод:** 9-этажный паспорт-план BLB-5 (Studio 5 + Split 4) живёт пока только на мосту — в `from-windows/05-VISUAL-MAP-TO-bLb.md` (Hy4, 29.08 20:29), а не в репо. В репо Мак довёл studio/split до уровня кадастра (houses.yaml v0.2, rooms), но floor-паспорта (9 шт) ещё НЕ сгенерированы и НЕ закоммичены. То есть: кадастровая основа (здания studio/split) — готова; детальные 9 паспортов этажей — НЕТ (ждут либо прогона city-metrics/city-gen на ПК, либо переноса спеки из 05-VISUAL-MAP в houses.yaml/BUILDING.md).

---

## МИНИАТЮРА (сводка)
Коммиты 28-29.08: HEAD `a691c2f` (007, mask TG token), `2bdad26` (007, Mac city-audit briefing), `7d165d1` (007, purge TG tokens + Hy4 secrets pkg), `b047772` (007, V3 PROD PUSH тег v2-final-production → 780db23) — и **НОВЫЕ Мак-коммиты ПОСЛЕ 5090d9e ЕСТЬ** (9 шт: `e826b96`…`0dd77cc`, цепь bLb cadastre/GLM). Город: `houses.yaml v0.2` (`a3a6426`, 19 зданий, реальные loc/files), `city-gen.mjs v2` — прогнан Маком JSC **0 ошибок** (19 зд/7 кварталов/14 линий/9 остановок), `bLb-CITY-v0.2-quiet.html` (`780db23`) — база; **`city-metrics.mjs` ЕЩЁ НЕ ПРОГНАН → city-metrics.json нет → ЗАДАЧА ПК НЕ ВЫПОЛНЕНА**. Мост: from-windows свежее `00-ALERT.md` (29.08 23:19); to-windows свежее `SPLIT-CORRECTION-VIS2` (29.08 22:43). Design-refs: 19 PNG + CONTEXT/MANIFEST; ключевые 04/05/11/12/13/17/18 — все на месте. BLB-5: кадастр studio/split готов, 9 floor-паспортов — НЕТ (только в 05-VISUAL-MAP на мосту).

_Составил explore (007-Linux): перебор HEAD ancestry + author-date/DAG + чтение REGISTRY/bLb/INBOX/bridge (только чтение). Никакие файлы не изменены/не закоммичены._
