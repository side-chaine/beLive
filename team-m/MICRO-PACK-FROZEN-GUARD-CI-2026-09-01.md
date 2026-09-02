# MICRO-PACK · FROZEN-GUARD-CI (Х-3 → механизм) · 2026-09-01 · v2 (стресс 002: 5 патчей внесены)

**ПОРЯДОК ПРИМЕНЕНИЯ (002 У-1): FG-CI строго ДО Волны A.** После сноса patchV1 (Волна A) манифест-строка удаляется В ТОМ ЖЕ коммите сноса (правило одного коммита). Волны сериализованы GO Никиты — параллельных правок манифеста нет (002 У-4: дробление = оверкилл, отклонено).

**Автор:** 007 (спека; фураж: FROZEN-AUDIT-301 §7-§8 + заказ 200 диспатч 07:30) · **Стресс:** 002 (следующий круг)
**HEAD-SSOT:** `4913e4c` · канон: tsc=290 🔴 · vitest=808+0int+0load 🟢 (69) · PARITY PASS
**Суть:** «frozen 0» перестаёт быть честным словом — становится SHA-механизмом в CI.

## Состав

### FG-1. `frozen-manifest.json` (НОВЫЙ, корень) — 19 файлов, два блока (301 §4/§8)
```json
{
  "version": 1,
  "note": "SHA-механизм охраны frozen-зоны. Тесты НЕ в манифесте (страховка — не замок). Канон: 4 зоны · 19 файлов (FROZEN-AUDIT-301 §7, wc=5299).",
  "guard": {
    "src/audio/core/AudioEngineV2.ts": "c5311543716de2f9c2317b85dee0c676c219e0242702a23fe11a435778ed6f92",
    "src/audio/compat/patchV1.ts": "0e599c349d104e7737ecd902d4fc64da89f2c278fae61602b2562b32f9924a30",
    "src/services/track.orchestrator.ts": "b8818e66e5cd5ff6ce158cdc6d02f824c9190c1cce4a6c555b73ad94946199bd",
    "src/bridges/live-guard.ts": "a87b3fd22dca826e5d51df90eb5fa91c5ffb5f9aa38b32e067e3fb1299886ba8"
  },
  "graveyard": {
    "src/bridges/audio-reactive.bridge.ts": "377b2e5f5244289ba0601d92026b2f4b34124b1eec94a61d7143fdccd5fc156a",
    "src/bridges/audio.bridge.ts": "f2ad1cabd829edc50dca4b39cf5f7ce54e66e2107e68c8a83672d4d2ead9e4f3",
    "src/bridges/blocks.bridge.ts": "8eb0cf3f5f2f512e38db02ed2788099a4f3c747405777741e27ab5d840ec4a27",
    "src/bridges/cover-theme.bridge.ts": "84cd0a54a7585ab8dcb28888e668b0921be4c528ac1cc7f90d2d682ca33be2f4",
    "src/bridges/loop.bridge.ts": "1375957a2b391b798570b22eb74bb7e2728108e14794b2088dfafc032c784d1c",
    "src/bridges/lyrics.bridge.ts": "059944b4ee16066be77d95fd9e8a7ad831dcd6dafa30b9b0e39dcc99c6334aa7",
    "src/bridges/markers.bridge.ts": "37ba77ac692c9cb2fdf235d1ce986a45acb1b3bc1bf302ed7775cea78b8ab81b",
    "src/bridges/mode-switch.bridge.ts": "72efdf8e219df2726cfec1328364da2bbcfa78b847202c74128f15348678b7df",
    "src/bridges/mode.bridge.ts": "ebd056555ccc1f07ed51a4af629887a49fafaed68ebb493eab8a68aa3fc89c50",
    "src/bridges/monitor.bridge.ts": "5030cf93c67e8f45c9f6ac2f67e504e3cb5bc29ba37749cd436289d23938516e",
    "src/bridges/plate.bridge.ts": "6909a7e748e35fa71acbbbb90825c9f15be119409046f22cc999874a2dff44e3",
    "src/bridges/stem-reactive.bridge.ts": "473e506882aea9fa2b4ecad609d6dabe3fe202a9d8c6341a4f3e297867461cab",
    "src/bridges/textStyle.bridge.ts": "670ffa4cc42bd79972cc0204cf50b6004a3c55fb5fc39337601b8419f660f1c0",
    "src/bridges/time-sync.ts": "6d2bece240187d05cdb9093f1153ba3e9f6118191a3560556c0d8e226c31e876",
    "src/bridges/track.bridge.ts": "8e30b54d5ba79f1e110d685dd949024973df0ec00bd484d0c5cdde4793ec28c9"
  }
}
```
> ⚠️ **ИСПОЛНЕН Волной C 01.09:** все 15 graveyard-SHA в истории (graveyard теперь пуст); guard = 2 (AudioEngineV2 + live-guard). Док-спека ниже — историческая (не стирать, пометить; актуальный манифест — `frozen-manifest.json`).
⚠️ ДЕФЕКТ АУДИТА ПОЙМАН СВЕРКОЙ (007): в §7 patchV1 имел SHA-копипасту от track.bridge (8e30b54d...). Живой факт: patchV1 = 0e599c34... (вышеправленное). Все 19 SHA сверены хешами живого дерева 007 лично — 18/19 аудита верны, patchV1 исправлен. Оператор НЕ пересчитывает — манифест выше = истина на 4913e4c.

### FG-2. `scripts/check-frozen.mjs` (НОВЫЙ)
- читает `frozen-manifest.json`; для каждого файла: sha256-факт vs манифест.
- **guard-файл изменён → ERROR (exit 1) + список дельт.**
- **graveyard-файл ИЗМЕНЁН → ERROR** (002 У-2: молчаливая правка трупа = отравление bridge↔wrapper-диффа Волны C; до Волны C трупы неприкосновенны байт-в-байт).
- **файл из манифеста отсутствует → ERROR (guard И graveyard)** — легальный снос обязан атомарно удалить манифест-строку в том же коммите (002: самопринудительность атомарности).
- exit 0 = заморозка цела.

### FG-3. `package.json`: script `"verify:frozen": "node scripts/check-frozen.mjs"`.

### FG-4. `.github/workflows/deploy.yml`: шаг после тестов `npm run verify:frozen` (до build).

### FG-5. Доки: frozen-zones-v2.md — приписка-якорь «механизм: frozen-manifest.json + verify:frozen (с 01.09, FG-CI)»; слово-мост для 003 (F-16-кандидат).

## Гейты
1. `npm run verify:frozen` → **exit 0** (все 19 SHA сходятся на живом дереве в момент применения; НЕ на мёртвом SHA из истории)
2. Мут-тест (локальный РУЧНОЙ ритуал при приёмке, НЕ в CI — 002 У-3): изменить 1 байт guard-файла временно → verify:frozen = ERROR с дельтой → откат. Доказательство, что замок работает.
3. tsc=290 Δ0 · vitest=808/69 Δ0 · PARITY PASS (скрипты вне tsconfig include)
4. CI-yml валиден: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/deploy.yml','utf8'))"` (js-yaml в devDeps — 002 У-5).

## КАНОН-ГРАНИЦА (002 У-6)
- **Манифест (19) = операционный канон frozen.** Рассинхрон с frozen-zones-v2.md (audioContext.ts «permanent frozen» по доку, но живой — 10 импортёров) закрывает 003 в F-16: док → операционная зона. audioContext.ts НЕ в манифест (живой, нужен для ДГ-13).
- Опционально в FG-2 (002-усиление): resurrection-детектор — новый .ts в src/bridges/ вне манифеста → WARN.

## НЕЛЬЗЯ
- НЕ включать тесты в манифест (страховка ≠ замок, 301 §2)
- НЕ менять сами frozen-файлы
- НЕ охранять graveyard как guard (это трупы до Волны C)
- Волна A (patchV1-снос) — ВЗАИМОДЕЙСТВИЕ: при её GO манифест-строка patchV1 удаляется В ТОМ ЖЕ коммите (гейт Волны A «frozen 19→18» уже это говорит)

## Маршрут
007-спека (этот док) → стресс 002 → Оператор (general) → гейты → коммит 007 → 006 Д-КЕЙС 5 (сверка манифеста) → «frozen 0» = механизм.

— 007 · 01.09 · FG-CI на стресс
