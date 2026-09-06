# В-1 «ДОКИ» · ФУРАЖ-ДОСЬЕ К2-УРОЖАЯ (для пары 003+003_2, волна V2-похорон) · 2026-09-01

**Автор:** 003 (по скауту-O, very thorough, 01.09) · **Статус:** ФУРАЖ (не пак! волна ждёт GO 200 — принцип 3-х классов на подтверждении) · **HEAD-SSOT** `38338a3`
**Классификация:** К1 легит-имя (живые сущности — НЕ трогать) · К2 устаревший-нарратив (править) · К3 история-эра (НЕ трогать)

**Итог пасса:** 26/49 живых доков с V2-маркерами · К1=59 · **К2=17 строк (+2 бордлайн)** · К3=26. Единый паттерн К2: «AudioEngineV2 = транспортный авторитет / Owner / currentTime».

⚠️ **Калибровка правок (003, против формулировок скаута):** замены типа «V3-фасад — транспортный авторитет» НЕ использовать (F-2/002-условие-5: «runtime authority» в формулировки не возвращать; PLAN §2 не носитель). Канон-шаблон правки: **«V3 — дефолт с 28.08 (W6-финиш); transport-слой = V3 (engine-v3/ + фасад js/audio-facade-v3.js), frozen V2-ядро — до M5 (read-only, PLAN-v3.3)»** — короткие версии по контексту строки.

## К2-урожай (17 строк, 9 файлов — пачка В-1а)

| файл:строка | было | стало (короткая форма, по контексту) |
|---|---|---|
| architecture/central-bridge.md:41 | V2Adapter «Единственный мост к frozen V2» | «Живой мост V2↔V3 (delegateSync, V2Adapter.ts:51)» |
| architecture/frozen-zones-v2.md:66 | «ЧИТАТЬ через V2Adapter (единственный bridge)» | «ЧИТАТЬ через V2Adapter (мост V2↔V3)» |
| architecture/takes-system.md:194 | Transport authority = AudioEngineV2 | Transport = V3 (фасад), frozen V2 — делегируемое ядро |
| architecture/takes-system.md:873 | Full transport authority remains in AudioEngineV2 | Transport = V3-слой (W6-финиш); frozen V2 — до M5 |
| architecture/reactive-lyrics-foundation.md:86 | **Owner:** AudioEngineV2 | **Owner:** V3 transport (фасад) |
| architecture/reactive-lyrics-foundation.md:158 | AudioEngineV2 currentTime | фасад currentTime (V3) |
| architecture/reactive-lyrics-foundation.md:445 | transport authority in AudioEngineV2 | transport in V3-слое |
| architecture/performance-quality-system.md:62 | Owned by: AudioEngineV2 | Owned by: V3 transport (фасад) |
| BILI-CONTEXT.md:70 | «AudioEngineV2 — единственный транспортный авторитет» | «V3 — дефолт (28.08); transport-слой V3; frozen V2 — до M5» |
| guides/Onboarding Route 2.1.md:50 | AudioEngineV2 transport authority | V3 transport (js/audio-facade-v3.js) |
| guides/Onboarding Route 2.1.md:123 | AudioEngineV2 as transport authority | V3-фасад as transport |
| ~~guides/Onboarding Route 2.1.md:221~~ | СНЯТО сверкой 003_2: список путей чек-листа, не нарратив | — |
| ~~guides/Onboarding Route 2.1.md:416~~ | СНЯТО сверкой 003_2: список путей чек-листа | — |
| guides/Onboarding Route 2.1.md:567 | AudioEngineV2 is transport authority | V3-фасад is transport surface |
| guides/Onboarding Route 2.1.md:684 | verified AudioEngineV2 transport authority | verified V3 transport (фасад) |
| modernization/04-bLb-BRIEFING.md:119 | «I-2. AudioEngineV2 владеет транспортом» | «I-2. Транспорт — V3-слой (W6-финиш); frozen V2 — до M5» |
| ~~modernization/09-BLB17...:45~~ | К3-ЗАЩИТА (сверка 003_2): ретракт-запись состояния эры — НЕ править | — |

## Бордлайн (2 — ВЕРДИКТ 003_2: ПРАВИТЬ синхронно; судьба audio-engine.md решена F-2 — обновлённый состав)

1. **INDEX.md:12** «audio-engine | AudioEngineV2 + transport + stem system» — после F-2 док станет «V2 frozen + V3 production»; ярлык индекса → «V2 frozen + V3 transport + stems». Рекомендация 003: править (живой индекс должен видеть новый состав).
2. **track-meta-pipeline.md:382** «audio-engine.md | AudioEngineV2 транспорт» → «V2 frozen + V3 transport». Рекомендация: править синхронно с INDEX:12.

## К3-защита (не трогать — история эры)
PLAN-v3.3 (миграционная терминология — живой план Ц3) · HISTORY-MAP (7 вхождений — ретроспектива) · n-stem (15 — W-история волн) · audit/00-INDEX (CEO-решения эры).

## Гейты волны (когда получит GO)
0. **Гейт-ретракт (003_2):** `sed -n '45p' docs/modernization/09-BLB17-RETRACTED-SYNCED-CHECK.md` → без изменений после волны (К3-защита)
1. `rg -n "транспортный авторитет|transport authority" docs/ --type md | grep -v archive` → только канон-формулировки V3
2. `rg -c "AudioEngineV2" docs/guides/` → снижен с 8 до ≤2 (frozen-упоминания ок)
3. Спорные К1-пограничные (w11:186, track-loading:124 — продюсеры/Owner frozen-класса) — НЕ трогать в волне 1, отдельный вопрос 201 (фасад эмитит те же события)
