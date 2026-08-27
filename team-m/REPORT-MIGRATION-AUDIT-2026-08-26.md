# REPORT-MIGRATION-AUDIT — 2026-08-26 (chain 001→002→001→009)
> Независимый read-only аудит готовности v2→v3 на живом дереве ПК. Цепь: 001 recon → 3 скаута (flip/V2Adapter/globals+gates) → 002 stress → 2 скаута (corrected-gates / reachability) → 001 re-recon → 009 verdict. Ведущий: 007_Мак (Far Light). Hub (007_Винда) исполняет волны параллельно.

## ФИНАЛЬНЫЙ ВЕРДИКТ (009): ОТЛОЖЕНО
**Продолжать код-правки — БЕЗОПАСНО. Сертифицировать завершение волн по ТЕКУЩИМ гейтам/плану — ЗАПРЕЩЕНО.**
- Frozen-зона чиста, флип (2395c1e) — обратимый 2-файловый bypass, V2-путь достижим → механически правки безопасны.
- НО сертификация под текущими гейтами даёт FALSE-GREEN: W5 false-PASS (минус require()/dynamic/alias), V2Adapter «→0» self-match ловушка, globals недосчёт.

## КЛЮЧЕВЫЕ НАХОДКИ
1. **V2-глобалы: истинная досягаемость ~62 файла / ~250+ точек чтения** (audioEngine~40, lyricsDisplay~22, trackCatalog~17, markerManager~17, app~9, waveformEditor~6, liveMode~1, __belive~1) через `window.X` + `(window as any).X` + `w.`-алиас. План базировал W1/BAC-105 на «9 файлов/12 ридеров» (grep-артефакт прямого `window.X`). **W1 недооценён ~20×.** Сейчас держится backward-compat шимом (V2-глобалы публикуются под v3) — отсюда «механически безопасно».
2. **Исправленные гейты ВСЕ FAIL на живом дереве** (ожидаемо — волны в процессе): W2 V2Adapter 18 файлов (после исключения def/barrel), delegateSync 11 non-test; W4 orchestrator 3 живых импортёра (MixerPanel:180, QuickActions:214, track.actions:7); W5 a/b/c/d — все non-empty, плюс `.bak` leftover + legacy-остатки в `src/audio/engine-v3`.
3. **Главный риск — False-Green DONE:** Hub может объявить волны завершёнными по зелёным-но-неверным гейтам → v3 уходит в прод, тихо завися от ~250 V2-сайтов, подпёртых не-декомиссированным shim.

## ИСПРАВЛЕННЫЕ ГЕЙТЫ (от 002, принять)
```bash
# W2
grep -rln "\bV2Adapter\b" src | grep -vE 'src/audio/engine-v3/(V2Adapter\.ts|index\.ts)'   # → EMPTY
grep -rln "delegateSync" src | grep -v '/__tests__/'   # тренд в V3-surface (не 0)
# W4
grep -rnE "(import|require|from).*track\.orchestrator" src | grep -v '/__tests__/'   # → 0
ls src/audio/engine-v3   # удалять 9 legacy ТОЛЬКО когда выше 0
# W5 (все 4 должны быть EMPTY)
grep -rnE "\b(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)\b" src
grep -rnE "require\(['\"].*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src
grep -rnE "import\(['\"].*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src
grep -rnE "\(window\s+as\s+any\)\.(audioEngine|app)|\bw\.(audioEngine|app)\b" src
```

## DOC-CHECK (что поправить в волн-доках ДО того, как Hub им доверится)
1. `WAVE-PREFLIP-BASELINE.md` L33-36/L19 — счётчики устарели: delegateSync 23→**11**, V2Adapter 27→**18**, orchestrator 7→**3**, globals 9/12→**62/~250**. Заменить на live; 9/12 пометить как grep-артефакт.
2. `WAVE-EXEC-PLAYBOOK.md` L19 — те же устаревшие счётчики.
3. `WAVE-EXEC-PLAYBOOK.md` L24 (W1 gate) — ловит только `window.audioEngine|__belive`; покрыть все 7 глобалов + dynamic/alias + требовать capture истинного baseline.
4. `MICRO-PACK-WAVE1.md` L8/L13/L24/L27 — BAC-105 scope 12/9 → **62/~250**; требовать proof декомиссии shim, не только safe→0.
5. `WAVE-EXEC-PLAYBOOK.md` L28 & `MICRO-PACK-WAVE2.md` L22 — W2 gate `V2Adapter→0` самоматчится (ловушка) + противоречит W4 DEFER/RETAIN. Гейт = «importers repointed, V2Adapter.ts разрешён к сохранению».
6. `WAVE-EXEC-PLAYBOOK.md` L42/L50 & `MICRO-PACK-WAVE5.md` L26 — W5 final misses require()/dynamic/alias → false-PASS. Добавить dynamic/require/alias passes.
7. Canon drift: baseline L6 vitest **772** vs wave-паки 767+5int+2load — один SSOT.
8. `MICRO-PACK-WAVE3.md` L2/L52 & `WAVE-EXEC-PLAYBOOK.md` L57 — утверждают «009 РЕШЕНО». 009 РЕШЕНО **не выдавал**; это auto-РЕШЕНО = False-Green DONE. Убрать преждевременное РЕШЕНО; completion только на исправленных гейтах + true baseline.

## РЕКОМЕНДАЦИЯ БОССУ
Не сертифицируйте волны по зелёным-но-неверным гейтам — внедрите исправленные гейты и истинный baseline 62/~250 СЕЙЧАС, иначе v3 уходит в прод тихо на живом backward-compat shim.

— 007_Мак (Far Light). Цепь завершена; вердикт ОТЛОЖЕНО; wave-доки трогать НЕ стал (Hub правит их в своём дереве) — правки по DOC-CHECK пусть применит Hub либо я после его коммита.
