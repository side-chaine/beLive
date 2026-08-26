# 📨 SYNC-MAC-TO-HUB · 2026-08-26c · питч-коннект пак + статусы
> От: 007_Мак (Far Light) · Кому: 007 (Hub/Near Light) · СС: Босс
> Правило имён: далее Ведры = «007», Мак = «007_Мак» (по просьбе Босса).

## 1. HTML-ПРОЕКЦИЯ — DONE ✅
Босс подтвердил: 007 уже собрал `VISUAL-MAP.html` (коммиты `0a40ca6`/`2adf716`: миграция + 22 зоны + баги + пайплайн + рефы через localStorage). Пункт (в) из брифинга 26a ЗАКРЫТ.

## 2. ПИТЧ-КОННЕКТ MICRO-PACK (design, ждёт OPT-IN)
- `MICRO-PACK-PITCH-CONNECT.md` — минимальный путь (~60–80 строк, 2–3 файла: `pitch-engine.ts` safe-shim `get()/init()`+`retarget`; `PitchTab.tsx` через `MicSourceV3.acquire` + `getAudioContext`, без `window.audioEngine.*`). Якоря 009 (9/9) все учтены.
- Обоснование минимализма: `pitch-engine` УЖЕ transport-agnostic → полный `PitchBus` (~400 строк) избыточен (инсайт 009).
- КОРРЕКЦИЯ БОССА учтена: 80% детекций точны, глюки 20–30% (не системная ошибка) → КАЧЕСТВО (автотюн) ОТЛОЖЕНО в post-m3 «большую уборку»; сейчас только ПОДКЛЮЧЕНИЕ (guard), чтобы после флипа Notes не пустовало.
- Действие 007: при OPT-IN Босса применить F1/F2 (canon 306/772), Босс меряет Notes на живом V3 ДО M3-GO.

## 3. FOUC + Other-фейдер (P1 #1/#2)
Recon `reports/mac-007/fouc-stem-recon.md` (GROUP A/B) ждёт применения 007. Связь: #2 СМЕЖЕН с №18-BUS (без #2 bus-фейдер на `other` не действует).

## 4. Student-Педагог (S3)
Hunt `reports/mac-007/student-pedagog-worker-hunt.md`: модуль `Rehearsal` (WebRTC + CF Worker `gateway/rehearsal`) УЖЕ есть; видео НЕ замкнуто end-to-end (`attachLocalTracks` не вызывается, `onRemoteStream` не подписан). Greenfield = видео-панели/доска/YouTube поверх готового каркаса. Готов начать как отдельный стрим.

## 5. СТАТУС
Far выполнил прогоны + спроектировал питч-коннект. Открытые: (а) OPT-IN Босса на питч-патч; (б) применение FOUC/Other 007; (в) старт S3 (видео) — по слову Босса.

— 007_Мак 🍎
