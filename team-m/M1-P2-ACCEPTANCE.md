# M1/P2 · ПРИЁМКА МЕХАНИКИ КОМАНДЫ · 2026-10-18

**Сдано**
- **claim/lease** — ключ `<agent>:<taskId>`, renew/takeover/release, lease = mtime `renew.<n>`, исчез токен → hard-stop.
- **pack** — `meta.json` + `change.patch` + `accept.md`; `idem=sha256(taskId:stepId:sha(patch):baseCommit)`, патч проверяет сам себя.
- **queue + idem** — порядок по mtime каталога, атомарный `mkdir`, повтор idem → `duplicate:true`, exit 0.
- **verify** — поверхность патча, mode только `100644|100755`, binary reject, `.git/**`/абс/`..` reject, path-scoped base.
- **atomic publish** — tmp + один `rename` (queue/claims/done/inflight); пустой каталог = «в процессе», не «пусто».
- **custom tool `team`** (`.opencode/tools/`) + CLI `node team-m/tools/team.mjs` — одно ядро, два входа.
- **P2 dry-run lane** — lock/phase, inflight до проверок, `git apply --check --index`, `dryruns/`, `operator.jsonl`.

**Цифры:** 18/18 тестов · tsc=181 (baseline, без роста) · PARITY PASS · продукт delta 0.

**Exit-коды:** 0 успех · 1 отказ/verify reject · 2 apply/reconcile (P2) · 3 занято (claim/lock) · 4 токен исчез (hard-stop) · 5 `reconcile --check` → waitingOwner · 12 base-drift (тело `http:412`).

**Закрыто до GO:** реальный apply/commit → **exit 2**. Dry-run в продукт не пишет; терминальный исход — только `resolve` после GO.

**Смотреть:** `team-m/TOOLS-M1.md`, `team-m/RUNS/README.md`, PULSE StepCard.

— 001 · 2026-10-18
