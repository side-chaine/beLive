#!/usr/bin/env python3
"""registry-push.py — атомарная запись LOG-блока в SHARED-REGISTRY (мост-доминант).
Использование: python3 scripts/registry-push.py <файл-блока.md> ["<якорь-подстрока>"]
Якорь по умолчанию — первый '## LOG' сверху (блок вставляется НАД ним).
Мост доминирует: перед вставкой забирает мост в team-m (если расходятся), вставляет, копирует на мост, проверяет."""
import sys, subprocess, shutil, re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOCAL = REPO / 'team-m/SHARED-REGISTRY.md'
BRIDGE = Path('/mnt/c/Users/nikit/beLive-bridge/SHARED-REGISTRY.md')

def sh(cmd): return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

block_file = Path(sys.argv[1])
anchor_sub = sys.argv[2] if len(sys.argv) > 2 else None
block = block_file.read_text(encoding='utf-8').rstrip() + '\n\n---\n\n'

# 1. Мост-доминант: если мост отличается и НОВЕЕ по mtime — берём мост
if BRIDGE.exists():
    if LOCAL.read_text(encoding='utf-8') != BRIDGE.read_text(encoding='utf-8'):
        if BRIDGE.stat().st_mtime >= LOCAL.stat().st_mtime:
            shutil.copy2(BRIDGE, LOCAL)
            print('[registry-push] мост новее/расходится → забрал мост в team-m (его правда)')
        else:
            print('[registry-push] ⚠️ локал новее моста → локал доминирует (мост отстал)')

# 2. Вставка блока над якорем
s = LOCAL.read_text(encoding='utf-8')
if block_file.name.replace('.md','')[:40] in s:
    print('[registry-push] ⚠️ блок уже есть — пропуск (идемпотентность)'); sys.exit(0)
m = re.search(r'^## LOG .*$', s, re.M)
if anchor_sub:
    m2 = re.search(rf'^## LOG .*{re.escape(anchor_sub)}.*$', s, re.M)
    m = m2 or m
if not m:
    i = len(s)  # нет LOG-блоков — в конец
else:
    i = m.start()
LOCAL.write_text(s[:i] + block + s[i:], encoding='utf-8')

# 3. Копия на мост + verify
shutil.copy2(LOCAL, BRIDGE)
verify = BRIDGE.read_text(encoding='utf-8')
head = block.splitlines()[0] if block.splitlines() else ''
if head and head[:60] in verify:
    print('[registry-push] ✓ блок на мосту подтверждён:', head[:70])
else:
    print('[registry-push] 🔴 VERIFY FAIL — блок не найден на мосту! Проверь руками')
    sys.exit(1)
