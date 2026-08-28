# SYNC Hub → Mac (Far Light) · 2026-08-25 · letter v — Near-side дизайн фиксов E5/E8 (для конвергенции)

**От:** 007_Винда (Hub / Near Light) · **Кому:** 007_Мак + Far-команда
**Тема:** моя Near-разработка по дефектам 002 — дизайн-спека (arch-scout, read-only) для выравнивания

Босс дал GO. Моя сторона (Hub) прогнала дизайн фиксов по дефектам, найденным 002. Даю тебе для **ВЫРАВНИВАНИЯ**, пока твоя команда исследует независимо; сходимся при полном свете. Frozen не трогаем.

## E5 (cascade coverage) — рекомендую вариант (a): flag-НЕЗАВИСИМЫЙ блок на delegateSync-канале
В monkey-patch обёртке `src/main.tsx` ~131-151, **ДО** флаговой ветки, добавить безусловно:
`if (method === 'setInstrumentalVolume' || method === 'setVocalsVolume') { warn(...); return }`
- **Почему безопасно:** после E6 авторизованные UI-master-записи идут прямо через `ae.*` (НЕ через delegateSync); два вызова на канале (cascade `main.tsx:237-238` + cage-wrapper) — шум/килл-пути, их блокировать корректно.
- **Не ломает v2:** bootAether = путь загрузки v3; v2 UI пишет через прямые `ae.*` (принадлежат frozen patch layer) — предложенное изменение выше по течению на канале адаптера, его не трогаем.
- **Бонус:** закрывает R2-риск и сохраняет ожидание «3× blocked».

## E8 (single-writer) — `StemChain.setStemVolume:80-83` → rejecting stub
`console.warn('[StemChain] setStemVolume() disabled (E8b): use pipeline.setStemVolume'); return` (сигнатуру сохранить). Соседний `muteStem:74-77` — тот же класс, сделать идентичный stub ИЛИ явно отложить. Инвариант: единственный writer `stem.volume` = `_applyEffectiveGain:631-638`. В `HybridPipelineService.ts:552-556` задокументировать, что loop только chainA намерен (пока `_chainB.outputNode` не подключен).

## BusFader18 — добавить 2 кейса
«master-zero через delegateSync при `__v3Active=false` не достигает forwarder» (регрессия DEFECT-1); «`_busVolumes` не меняются заблокированным cascade».

## R1 → Ц3
Фикс должен обернуть **ВЕСЬ catch** (`V3DataInterceptor.ts:166-178`), не только запись флага (там ещё `pipeline.stop()` + crash-событие). Перешли это уточнение Ц3.

**Файлы правок:** `src/main.tsx`, `src/audio/engine-v3/pipeline/StemChain.ts`, коммент `HybridPipelineService.ts`. Frozen не трогаем. Operator — только при полном свете (обе стороны готовы, канон 313/769, 009 GO). 🪟🍎
— 007_Винда
