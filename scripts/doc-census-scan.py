#!/usr/bin/env python3
# scripts/doc-census-scan.py — R-1.1 state-черновик (LIVING/HISTORY/REFERENCE/UNCLEAR)
# Автор-патент: 003_2 (CENSUS-SCANNER-PROPOSAL 15:31) — установлен 007 04.09 23:1x
# при ведении переписки по GO Никиты (развилка «007 ведёт»), состав дословный из PROPOSAL.
# Канон: v1.1 §0 (state × visibility ортогональны), Опус §3 (census head/measured_at), 003_2 CROSS-CHECK (полнотекст)
import os, re, subprocess, sys, datetime

LIVING_PAT = re.compile(
    r'(src/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs)|js/[A-Za-z0-9_-]+\.js'
    r'|tsc\s*=\s*\d|vitest\s+\d|frozen\s+\d+/\d+|verify:\w+'
    r'|:[0-9]{2,4}\b|LOC|wc -)'
)
HIST_PAT  = re.compile(r'(HISTORICAL|SUPERSEDED| устарел|эра-|Срез на дату)', re.I)
C3_PAT    = re.compile(r'>\s*⚠️?\s*Срез на дату')
REF_PAT   = re.compile(r'(research|SOUNDTOUCH|внешн)', re.I)

def classify(rel, full):
    if '/archive/' in rel or 'packs/era-' in rel: return 'HISTORY'
    name = os.path.basename(rel)
    if REF_PAT.search(name): return 'REFERENCE'
    if C3_PAT.search(full[:2000]): return 'HISTORY'
    if HIST_PAT.search(full): return 'HISTORY'
    if LIVING_PAT.search(full): return 'LIVING'
    return 'UNCLEAR'

head = subprocess.run(['git','rev-parse','--short','HEAD'],capture_output=True,text=True).stdout.strip()
now  = datetime.datetime.now().astimezone().isoformat(timespec='minutes')
rows = []
for root,dirs,files in os.walk('docs'):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if f.endswith('.md'):
            rel = os.path.join(root,f).replace(os.sep,'/')
            full = open(rel,encoding='utf-8',errors='ignore').read()
            rows.append((rel, classify(rel, full)))
cnt = {}
for _,s in rows: cnt[s] = cnt.get(s,0)+1
print(f"# DOC-CENSUS scan · head: {head} · measured_at: {now}")
print(f"# meta: {{head: {head}, measured_at: {now}, heuristic_draft: {{LIVING: {cnt.get('LIVING',0)}, HISTORY: {cnt.get('HISTORY',0)}, REFERENCE: {cnt.get('REFERENCE',0)}, UNCLEAR: {cnt.get('UNCLEAR',0)}}}, heuristic_error_rate: null}}")
for rel,s in sorted(rows): print(f"{s}\t{rel}")
