# Character Layer — паспорт здания

**Status:** ✅ Living domain — паспорт создан 2026-08-28 (Track B, по инвентарю S1/S2; до этого домен был без документации).
**Код:** `src/character/`
**Квартал города:** 🤖 Башня Билли (houses.yaml id 014)
**Владелец:** center/007 (под доменом billi-ai)

---

## 1. Назначение

«Слой эмоций» персонажа: звуковая реакция на события AI-ассистентов и на приходящие отчёты Mac-команды. Провайдер-агностик: слушает ТОЛЬКО `aiHub`, звук data-driven через `CueSpec` под разных персонажей (Billy/English/Vocal Coach).

## 2. Состав

| Файл | Роль |
|------|------|
| `index.ts` | Саморегистрация: side-effect импорт в `main.tsx` регистрирует init `character-layer` в `initRegistry` (foundation/registry) — без ручных вызовов в boot (R9: нет конфликта с миграцией v3) |
| `sound/CharacterSoundManager.ts` | WebAudio standalone (МИМО frozen `AudioEngineV2`); подписка на `ASSISTANT_RESPONSE_COMPLETED`; cooldown 400ms от «долбёжки»; unlock AudioContext по первому жесту юзера (autoplay policy, G2-fix) |
| `notify-bridge.ts` | Поллинг `team-m/INBOX.md` (1500ms, `cache: no-store`); fallback — виртуальный импорт `INBOX.md?raw`; djb2 content-hash; при изменении → `emitReportArrived({source:'inbox-sync'})` |
| `layer2-report-emitter.ts` | G3-мост: завершение AI-ответа → событие `team-m.report-arrived` (`source:'mac-chat'`) |
| `notify-emit.ts` | Эмиттер события `team-m.report-arrived` |
| `__tests__/layer2-report-emitter.test.ts` | Тест эмиттера |

## 3. Контракты

- ❄️ **SoundCue union** (канон тайпинга ассистентов, REGISTRY 25.08): `{kind:'synth'} & CueSpec | {kind:'asset', url, gain}` — без хардкода под конкретного персонажа.
- ✅ **CUE_DEFAULT** (профиль Billy, HARD CONTRACT §4): sine, 880→1760 Гц, ~0.2с, gain 0.15.
- ✅ **NOTIFY_CUE** (Layer-2, отчёт Mac-команды): sine, 440→660 Гц, gain 0.12 — мягче Billy-cue.
- ✅ Звук включается/выключается через `getSoundEnabled()` (`js/ai/settings/ai-settings.store`).
- ✅ Единственный источник истины завершения ответа — `aiHub` (`js/ai/registry`); character-слой не владеет AI-логикой, только реагирует.

## 4. Границы и зависимости

- Зависит от: `foundation/registry/initRegistry` (саморегистрация), `js/ai/registry` (aiHub), `js/ai/settings`, `stores/notify.store`.
- НЕ зависит от транспортного audio-домена: WebAudio standalone — frozen `AudioEngineV2` не трогается (инвариант 2 доктрины соблюдён).
- Потребители события `team-m.report-arrived`: звуковой cue + будущий `avatar.store` (визуальная реакция аватара — шов ⚠️, см. event/listener map).

## 5. История

- Коммит `c0084c2` (2026-08-25): A3 notify-bridge + notify.store + character/sound (расширение пакета G3).
- P1#6 null-guard и SoundCue union — применены в цепях N3-β (tsc 313/769 на момент фиксации).
- `getProfileSound` — локальная функция в CoachPanel.tsx, registry.ts не трогать (условие ратификации 25.08).

## 6. Открытые швы

- ⚠️ Визуальная реакция аватара на `team-m.report-arrived` не реализована (только звук) — post-M3.
- ⚠️ Домен законсервирован вместе с AI-инфраструктурой (`js/ai/`, AI deferred): при разморозке AI проверить, что aiHub-контракт не изменился.

_Паспорт не содержит номеров строк; факты проверены по диску 2026-08-28._
