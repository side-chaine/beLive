#!/usr/bin/env python3
# gen-map-draft.py · 004 «Реестр-Пульс» · DRAFT-генератор скелета MECHANISM-MAP
# НЕ боевой генератор (scripts/gen-mechanism-map.mjs = коммит① Оператора по §8 СОЗВЕЗДИЯ-В).
# Этот скрипт = воспроизводимый источник чисел для drafts/MECHANISM-MAP-draft.yaml:
# прогоняет glob-команды УЗ-4 ДОСЛОВНО (PULSE-NERVOUS-2026-09-09-final.md §УЗ-4),
# строит union с дедупом, назначает id по конвенции, пишет YAML-скелет cold-start.
# Запуск: python3 team-m/zones/004/drafts/tools/gen-map-draft.py
import subprocess, sys, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]  # beLive/ (drafts/tools/gen-map-draft.py → 5 уровней вверх)
OUT = REPO / "team-m/zones/004/drafts/MECHANISM-MAP-draft.yaml"

# --- УЗ-4 дословно: классы 1-2 ---
C12 = r"find src -name '*.store.ts' -o -name '*.service.ts' | grep -v -E '(__tests__|\.test\.|\.bench\.)'"
# --- УЗ-4 дословно: фильтры классов 3-4 (паттерны в одинарных кавычках — shell-safe) ---
F34 = ["-not", "-path", "'*__tests__*'", "-not", "-name", "'*.test.ts*'", "-not", "-name", "'*.tsx'",
       "-not", "-name", "'*.json'", "-not", "-path", "'*vendor*'", "-not", "-name", "'*.tar.gz'",
       "-not", "-name", "'README.md'"]
DOMAINS = ["src/audio/engine-v3", "src/sync", "src/exercises", "src/deck", "src/foundation/event-bus"]

def sh(cmd):
    r = subprocess.run(cmd, shell=True, cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FAIL: {cmd}\n{r.stderr}")
    return [l for l in r.stdout.splitlines() if l.strip()]

c12 = sorted(sh(C12))
dom = {}
for d in DOMAINS:
    dom[d] = sorted(sh(f"find {d} -type f " + " ".join(F34)))
domains_all = sorted({f for d in DOMAINS for f in dom[d]})

overlap = sorted(set(c12) & set(domains_all))
union = sorted(set(c12) | set(domains_all))

# --- track-снимок: ls-tree feature/yt-prep (SB) ---
r = subprocess.run(["git", "ls-tree", "-r", "feature/yt-prep", "--name-only", "--", "src"],
                   cwd=REPO, capture_output=True, text=True)
sb = set(l for l in r.stdout.splitlines() if l.strip())
both = [f for f in union if f in sb]
main_only = [f for f in union if f not in sb]

# --- id-конвенция: id = basename ядра без .ts; коллизии basename -> СИММЕТРИЧНЫЙ префикс
#     родительской директории для ВСЕХ участников коллизии (двухпроходная схема, детерминировано) ---
def base_id(core):
    return core.rsplit("/", 1)[-1].removesuffix(".ts")

def parent_seg(core):
    return core[4:].rsplit("/", 1)[0].rsplit("/", 1)[-1]  # сегмент пути перед файлом

bases = {core: base_id(core) for core in union}
from collections import Counter
base_counts = Counter(bases.values())
ids = {}
for core in union:
    b = bases[core]
    ids[core] = f"{parent_seg(core)}-{b}" if base_counts[b] > 1 else b
assert len(set(ids.values())) == len(ids), f"ID-КОЛЛИЗИЯ после префиксов: {[k for k,v in ids.items() if list(ids.values()).count(v)>1]}"

# --- класс для сортировки/комментариев ---
def klass(core):
    if core in dom.get("src/audio/engine-v3", []): return "3-engine-v3"
    if core in dom.get("src/sync", []): return "4-sync"
    if core in dom.get("src/exercises", []): return "5-exercises"
    if core in dom.get("src/deck", []): return "6-deck"
    if core in dom.get("src/foundation/event-bus", []): return "7-event-bus"
    if core.endswith(".store.ts"): return "1-store"
    if core.endswith(".service.ts"): return "2-service"
    return "0-?"

now = datetime.datetime.now()
hdr = f"""# MECHANISM-MAP · DRAFT-скелет · cold-start · 004 «Реестр-Пульс» · {now:%Y-%m-%d %H:%M}
# РЕЖИМ: DRAFT — боевой team-m/MECHANISM-MAP.yaml не создаётся до маркера «Z2-применена+cron» в LOG
#        (HANDOFF-004 §РЕЖИМ; CONSTELLATION-В-v2 §8 два-коммита: ①генератор+скелет=Оператор ②разметка=004)
#
# ИСТОЧНИК-КОМАНДЫ (УЗ-4, PULSE-NERVOUS-2026-09-09-final.md — дословно, воспроизводимы):
#   классы 1-2: find src -name '*.store.ts' -o -name '*.service.ts' | grep -v -E '(__tests__|\\.test\\.|\\.bench\\.)'
#   классы 3-4: find <домен> -type f -not -path '*__tests__*' -not -name '*.test.ts*' -not -name '*.tsx'
#                -not -name '*.json' -not -path '*vendor*' -not -name '*.tar.gz' -not -name 'README.md'
#                домены: src/audio/engine-v3 · src/sync · src/exercises · src/deck · src/foundation/event-bus
#   МЕТОД: UNION классов 1-2 и 3-4 с дедупом — 7 файлов входят в ОБА гло­ба (двойной счёт снят):
#          exercise.store · sync.store · batch-publish.service · zip-export.service ·
#          ai-lyrics-sync.service · alignment-cache.service · lyrics-align.service
#
# СНИМОК {now:%d.%m} {now:%H:%M} (HEAD main 9ae7ea7; src/ в рабочем дереве чист):
#   класс1 stores=47 · класс2 services=28 · engine-v3=25 · sync=24 · exercises=15 · deck=3 · event-bus=27
#   пересечение=7 · UNION={len(union)} записей
#   снимок спеки УЗ-1/УЗ-4 (09.09): 46/28/26/24/15/3/27 (сумма 169) при «ИТОГО ≈162» —
#   расхождение per-class ±1 (stores 47 vs 46; engine-v3 25 vs 26 — спека, вероятно, считала
#   vendor/SignalsmithStretch.mjs.d.ts) при ТОЧНОМ совпадении union 162=162. Разбор: LOG 004 {now:%H:%M} + REFORM.
#
# TRACK-СНИМОК: track: both для всех {len(union)} строк — git ls-tree feature/yt-prep: {len(both)}/{len(union)}
#   присутствуют на SB-HEAD, main-only={len(main_only)} (проверено {now:%d.%m} {now:%H:%M})
#
# ID-КОНВЕНЦИЯ: id = basename ядра без .ts; коллизии basename -> СИММЕТРИЧНЫЙ префикс
#   родительской директории для всех участников: settings-ai-settings.store · stores-ai-settings.store ·
#   engine-v3-index · event-bus-index · generators-index · core-types · deck-types ·
#   event-bus-types · word-sync-types
#
# COLD-START (CONSTELLATION-В §E): ВСЕ строки tier:L3 + unclassified:true; synapses/imports/consumers/
#   docs/gates ПУСТЫ — разметку не выдумываю (волна-1 = задача №2 ROSTER-draft; L3->L1 только через 301).
#   zone-link: ORPHAN = осознанный cold-start (не «бесхозный»).
#
# ⚠️ РАСХОЖДЕНИЕ СПЕК (доклад CEO_1, обе цитаты — LOG/REFORM {now:%H:%M}): seed-ядра
#   src/services/track.loader.ts · track.actions.ts · upload.actions.ts · cover-theme-applicator.ts ·
#   device-calibrations.ts (5 файлов БЕЗ .service-суффикса) НЕ входят в glob УЗ-1/УЗ-4 => вне скелета,
#   при том что PULSE-NERVOUS-v2 §6 называет track.loader seed-ядром L1 (role≠stemId :266/:306/:533).
#   Скелет следует УЗ-4 дословно; решение о расширении охвата — за CEO_1/301.
"""

FIELDS = ["tier: L3", "unclassified: true", "seed: false", "owner-agent: null", "family: null",
          "track: both", "synapses: []", "imports: []", "consumers: []", "docs: null",
          "gates: []", "zone-link: ORPHAN", "hold: null"]

lines = [hdr.rstrip("\n"), "#"]
cur_k = None
for core in union:
    k = klass(core)
    if k != cur_k:
        cnt = sum(1 for f in union if klass(f) == k)
        lines.append(f"# ── класс {k} ({cnt}) ──")
        cur_k = k
    lines.append(f"- id: {ids[core]}")
    lines.append(f"  core: {core}")
    for f in FIELDS:
        if f.startswith("core:"):
            continue
        lines.append(f"  {f}")

OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

print(f"c12={len(c12)} (store={sum(1 for f in c12 if f.endswith('.store.ts'))}, service={sum(1 for f in c12 if f.endswith('.service.ts'))})")
for d in DOMAINS:
    print(f"  {d}={len(dom[d])}")
print(f"overlap={len(overlap)} UNION={len(union)} both={len(both)} main-only={len(main_only)}")
print(f"записей в файле: {sum(1 for l in lines if l.startswith('- id:'))}")
print(f"OUT={OUT}")
