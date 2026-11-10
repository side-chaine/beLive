#!/usr/bin/env bash
# Мок-прогон frozen-guard: сценарии на реальном теле workflow.
#
# Зачем: frozen-guard — гейт, который не запускается на PR, пока сам не в main.
# Единственный способ проверить его логику до мержа — подменить сеть и подать
# заранее заготовленные ответы API. Тело шага берётся ИЗ САМОГО yml (не копия),
# поэтому тест ловит расхождение между «что в файле» и «что проверено».
#
# Что проверяется:
#   T1-T5   структура триггера: workflow_run по «PR Gate», completed, без
#           pull_request/pull_request_target, права только read, concurrency
#   S0-S0b  прогон без PR (push) -> пропуск, exit 0
#   S1-S4   базовые критерии (FROZEN без метки -> красный, обычный файл -> зелёный)
#   S5-S6   package.json: правка блока scripts -> красный, правка deps -> зелёный
#   S7      защищаемый файл на второй странице пагинации -> красный
#   S8-S13  отказы: API вернул ошибку, битые метки, чужая метка, нечитаемый package.json
#   S14-S20b расширенный защищаемый список (tsconfig, vitest.config, allowlist-и, verify-asany,
#           сам этот харнесс)
#   S21-S25 процедура G: метка без секции «## frozen-ok reason» -> красный
#   S26-S30 источник данных workflow_run: GET /pulls, устаревший head, битый PR
#   S31-S34 пустой pull_requests при event=pull_request: поиск PR по коммиту,
#           пустой поиск -> красный, чужая база -> красный, API упал -> красный
#
# Требования: bash, python3 + PyYAML (на ubuntu-latest есть).
# Запуск:  bash scripts/check-frozen-guard.sh [путь-к-workflow] [путь-к-pr-gate.yml]
# Выход:   0 — все сценарии совпали, N — число расхождений.

set -uo pipefail

WORKFLOW="${1:-.github/workflows/frozen-guard.yml}"
PR_GATE="${2:-.github/workflows/pr-gate.yml}"

if [ ! -f "$WORKFLOW" ]; then
  echo "не найден workflow: $WORKFLOW" >&2
  exit 2
fi
if [ ! -f "$PR_GATE" ]; then
  echo "не найден pr-gate: $PR_GATE" >&2
  exit 2
fi

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

# Тело проверяемого шага вытаскиваем из yml: шаг, в котором объявлен PROTECTED.
python3 - "$WORKFLOW" "$T/step.sh" <<'PY' || exit 2
import sys
try:
    import yaml
except ImportError:
    sys.exit("нужен PyYAML: python3 -m pip install pyyaml")
doc = yaml.safe_load(open(sys.argv[1]))
if not isinstance(doc, dict) or "jobs" not in doc:
    sys.exit(f"{sys.argv[1]}: не похоже на workflow (нет jobs)")
step = None
for job in doc["jobs"].values():
    for s in job.get("steps", []):
        if "run" in s and "PROTECTED=" in s["run"]:
            step = s["run"]
if step is None:
    sys.exit(f"{sys.argv[1]}: не найден шаг с PROTECTED=")
open(sys.argv[2], "w").write(step + "\n")
PY

bash -n "$T/step.sh" || { echo "тело шага не проходит bash -n" >&2; exit 2; }

# Подмена сети: curl отдаёт заранее заготовленный файл по типу запроса.
# Отсутствие файла = 404 с телом {"message":"Not Found"} и кодом 22 (как у
# настоящего curl --fail-with-body), чтобы сценарии «API недоступен» были честными.
MOCK_DIR=""
curl() {
  local url="${*: -1}"
  local f=""
  # POST /check-runs: тело лежит в файле после --data-binary, его надо
  # сохранить, чтобы сценарии проверяли поля, а не факт вызова.
  case "$url" in
    *"/check-runs"*)
      local prev="" payload=""
      for a in "$@"; do
        case "$prev" in
          --data-binary|--data|-d) payload="${a#@}" ;;
        esac
        prev="$a"
      done
      if [ -n "$payload" ] && [ -f "$payload" ]; then
        cp "$payload" "$MOCK_DIR/check_run.json"
        printf '{"id":1}'
        return 0
      fi
      printf '{"message":"Bad Request"}'
      return 22
      ;;
  esac
  case "$url" in
    *"/pulls/"*"/files"*)
      local p="${url##*page=}"
      f="$MOCK_DIR/files_p${p}.json"
      ;;
    *"/commits/"*"/pulls"*) f="$MOCK_DIR/commit_pulls.json" ;;
    *"/pulls/"*) f="$MOCK_DIR/pr.json" ;;
    *"contents/package.json?ref=BASE"*) f="$MOCK_DIR/pkg_base.json" ;;
    *"contents/package.json?ref=HEAD"*) f="$MOCK_DIR/pkg_head.json" ;;
  esac
  if [ -n "$f" ] && [ -f "$f" ]; then
    cat "$f"
  else
    printf '{"message":"Not Found"}'
    return 22
  fi
}

PASS=0
FAIL=0

# run_case <имя> <ожидаемый exit> <каталог моков> [RUN_PRS] [HEAD_SHA] [EVENT]
run_case() {
  local name="$1" expected="$2" dir="$3"
  # Значения по умолчанию задаём отдельно: фигурные скобки внутри ${4:-...}
  # bash считает вложенными и обрезает подстановку.
  local run_prs="${4-}" head_sha="${5-}" event="${6-}"
  [ -n "$run_prs" ] || run_prs='[{"number":7}]'
  [ -n "$head_sha" ] || head_sha=HEAD
  [ -n "$event" ] || event=pull_request
  rm -f "$dir/check_run.json"
  set +e
  local out
  out=$(GH_TOKEN=x API_URL=https://api.github.com REPO=o/r \
        RUN_PRS="$run_prs" HEAD_SHA="$head_sha" HEAD_REPO=o/r \
        EVENT="$event" DEFAULT_BRANCH=main \
        bash -c 'MOCK_DIR="'"$dir"'"; '"$(declare -f curl)"'; . "'"$T"'/step.sh"' 2>&1)
  local rc=$?
  set -e
  if [ "$rc" -eq "$expected" ]; then
    printf 'PASS  %-52s exit=%s\n' "$name" "$rc"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %-52s exit=%s (ожидали %s)\n' "$name" "$rc" "$expected"
    printf '%s\n' "$out" | sed 's/^/      /'
    FAIL=$((FAIL + 1))
  fi
}

# check_case <имя> <success|failure|none> <каталог> [ожидаемый head_sha]
# Проверяются поля тела POST /check-runs, а не факт вызова: required поймает
# чек только при точном name и на head_sha головы PR.
check_case() {
  local name="$1" expected="$2" dir="$3" head="${4-HEAD}"
  if [ "$expected" = "none" ]; then
    if [ -f "$dir/check_run.json" ]; then
      printf 'FAIL  %-52s чек создан, а не должен\n' "$name"; FAIL=$((FAIL + 1))
    else
      printf 'PASS  %-52s чека нет\n' "$name"; PASS=$((PASS + 1))
    fi
    return
  fi
  if [ ! -f "$dir/check_run.json" ]; then
    printf 'FAIL  %-52s чек не создан\n' "$name"; FAIL=$((FAIL + 1))
    return
  fi
  if CHECK_EXPECT="$expected" CHECK_HEAD="$head" python3 - "$dir/check_run.json" <<'PY'
import json, os, sys
d = json.load(open(sys.argv[1]))
out = d.get("output") or {}
ok = (d.get("name") == "frozen-guard"
      and d.get("head_sha") == os.environ["CHECK_HEAD"]
      and d.get("status") == "completed"
      and d.get("conclusion") == os.environ["CHECK_EXPECT"]
      and bool(out.get("title"))
      and bool(out.get("summary")))
sys.exit(0 if ok else 1)
PY
  then
    printf 'PASS  %-52s чек %s\n' "$name" "$expected"; PASS=$((PASS + 1))
  else
    printf 'FAIL  %-52s поля чека не те\n' "$name"; FAIL=$((FAIL + 1))
  fi
}

mk() { mkdir -p "$T/$1"; }
put() { printf '%s' "$2" > "$T/$1"; }

# mkpr <каталог> <base_sha> <head_sha> <labels-json> [body]
# Ровно тот ответ GET /repos/{repo}/pulls/{n}, из которого гейт берёт base,
# метки и тело: в событии workflow_run этих полей нет.
mkpr() {
  local dir="$1" base="$2" head="$3" labels="$4" body="${5:-}"
  BASE="$base" HEAD="$head" LABELS="$labels" BODY="$body" python3 - "$T/$dir/pr.json" <<'PY'
import json, os, sys
labels = json.loads(os.environ["LABELS"])
json.dump({"number": 7,
           "base": {"sha": os.environ["BASE"]},
           "head": {"sha": os.environ["HEAD"]},
           "labels": [{"name": x} for x in labels],
           "body": os.environ.get("BODY", "")},
          open(sys.argv[1], "w"))
PY
}

# --- структура триггера ------------------------------------------------------
# Гейт обязан стартовать после PR Gate, а не на pull_request_target: тот
# блокируется в публичных репо. paths-фильтр недопустим — required check,
# который не стартовал, висит в «Expected» и блокирует мерж любого PR.
trigger_check() {
  local name="$1" expr="$2"
  shift 2
  if python3 -c "$expr" "$WORKFLOW" "$@"; then
    printf 'PASS  %-52s ok\n' "$name"; PASS=$((PASS + 1))
  else
    printf 'FAIL  %-52s структура не та\n' "$name"; FAIL=$((FAIL + 1))
  fi
}

ON_GET="import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); on=d.get(True) or d.get('on') or {}"

trigger_check "T1 workflow_run + completed" \
  "$ON_GET; w=on.get('workflow_run') or {}; sys.exit(0 if w.get('types')==['completed'] else 1)"
trigger_check "T2 имя workflow совпадает с PR Gate" \
  "$ON_GET; w=on.get('workflow_run') or {}; pg=yaml.safe_load(open(sys.argv[2])); sys.exit(0 if pg.get('name') in (w.get('workflows') or []) else 1)" "$PR_GATE"
trigger_check "T3 нет pull_request_target и pull_request" \
  "$ON_GET; sys.exit(0 if 'pull_request_target' not in on and 'pull_request' not in on else 1)"
trigger_check "T4 права: read + checks: write (ничего лишнего)" \
  "import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); p=d.get('permissions') or {}; ok=p.get('contents')=='read' and p.get('pull-requests')=='read' and p.get('actions')=='read' and p.get('checks')=='write' and set(p)=={'contents','pull-requests','actions','checks'}; sys.exit(0 if ok else 1)"
trigger_check "T5 concurrency по ветке-источнику" \
  "import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); c=d.get('concurrency') or {}; g=str(c.get('group','')); sys.exit(0 if 'workflow_run.head_branch' in g and c.get('cancel-in-progress') is True else 1)"

BODY_OK='## frozen-ok reason
- Зона: scripts
- Что изменено: добавлен шаг verify:eslint-directives в verify:ci
- Почему безопасно: новая проверка, существующие гейты не менялись
- Ссылка: t28'

BODY_EMPTY_FIELD='## frozen-ok reason
- Зона: scripts
- Что изменено: добавлен шаг
- Почему безопасно: новая проверка
- Ссылка:'

BODY_NO_BULLETS='## frozen-ok reason
Зона scripts, поменял шаг, безопасно, ссылка t28'

# --- источник данных workflow_run -------------------------------------------
# Прогон на push: pull_requests пуст, судить нечего.
mk s0; put s0/files_p1.json '[{"filename":"src/audio/engine-v3/core/Foo.ts"}]'
run_case "S0 push без PR -> пропуск" 0 "$T/s0" '[]' '' push
run_case "S0b push, pull_requests = null -> пропуск" 0 "$T/s0" 'null' '' push

# --- базовые критерии t26 ---
mk s1
put s1/files_p1.json '[{"filename":"src/audio/engine-v3/core/Foo.ts"}]'
mkpr s1 BASE HEAD '[]'
run_case "S1 FROZEN без метки -> red" 1 "$T/s1"
mkpr s1 BASE HEAD '["frozen-ok"]' "$BODY_OK"
run_case "S2 FROZEN + метка + обоснование -> green" 0 "$T/s1"

mk s3; put s3/files_p1.json '[{"filename":"src/components/Header.tsx"}]'; mkpr s3 BASE HEAD '[]'
run_case "S3 обычный файл -> green" 0 "$T/s3"

mk s4; put s4/files_p1.json '[]'; mkpr s4 BASE HEAD '[]'
run_case "S4 пустой список -> green" 0 "$T/s4"

# base.sha приходит из GET /pulls, а не из события — здесь это проверяется тем,
# что моки package.json лежат ровно под ref=BASE/HEAD из pr.json.
mk s5
put s5/files_p1.json '[{"filename":"package.json"}]'
put s5/pkg_base.json '{"scripts":{"lint":"eslint ."},"dependencies":{"react":"19.2.4"}}'
put s5/pkg_head.json '{"scripts":{"lint":"eslint ."},"dependencies":{"react":"19.3.1"}}'
mkpr s5 BASE HEAD '[]'
run_case "S5 package.json без правки scripts -> green" 0 "$T/s5"

put s5/pkg_head.json '{"scripts":{"lint":"eslint . --max-warnings 0"}}'
run_case "S6 package.json правит scripts -> red" 1 "$T/s5"

# 100 файлов на первой странице + защищаемый на второй: пагинация обязана работать.
mk s7
python3 - "$T/s7" <<'PY'
import json, sys
d = sys.argv[1]
json.dump([{"filename": f"src/components/f{i}.tsx"} for i in range(100)], open(f"{d}/files_p1.json", "w"))
json.dump([{"filename": "scripts/verify-asany.mjs"}], open(f"{d}/files_p2.json", "w"))
json.dump([], open(f"{d}/files_p3.json", "w"))
PY
mkpr s7 BASE HEAD '[]'
run_case "S7 защищаемый файл на 2-й странице -> red" 1 "$T/s7"

mk s8; put s8/files_p1.json '[{"filename":".github/workflows/pr-gate.yml"},{"filename":"eslint.config.mjs"}]'; mkpr s8 BASE HEAD '[]'
run_case "S8 .github + eslint.config -> red" 1 "$T/s8"

mk s9; put s9/files_p1.json '[{"filename":"vendor/lib.js"}]'; mkpr s9 BASE HEAD '["frozen-ok-next"]'
run_case "S9 чужая метка -> red" 1 "$T/s9"

mk sa; put sa/files_p1.json '{"message":"Bad credentials"}'; mkpr sa BASE HEAD '[]'
run_case "S10 files API вернул ошибку -> red" 1 "$T/sa"

mk sb; put sb/files_p1.json '[{"filename":"package.json"}]'; mkpr sb BASE HEAD '[]'
run_case "S11 package.json не читается -> red" 1 "$T/sb"

mk sc; put sc/files_p1.json '[{"filename":"vendor/x.js"}]'
put sc/pr.json '{"base":{"sha":"BASE"},"head":{"sha":"HEAD"},"labels":"not-a-list","body":""}'
run_case "S12 битые метки -> red" 1 "$T/sc"
put sc/pr.json '{"base":{"sha":"BASE"},"head":{"sha":"HEAD"},"labels":[{"name":null}],"body":""}'
run_case "S13 метки без имён -> red" 1 "$T/sc"

# --- расширение списка (запрос Центр_5 1.1) ---
mk sd
mkpr sd BASE HEAD '[]'
put sd/files_p1.json '[{"filename":"tsconfig.json"},{"filename":"tsconfig.node.json"}]'
run_case "S14 tsconfig*.json -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"vitest.config.ts"}]'
run_case "S15 vitest.config.* -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"scripts/ts-allowlist.json"}]'
run_case "S16 scripts/ts-allowlist.json -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"scripts/reach-holdlist.json"}]'
run_case "S17 scripts/reach-holdlist.json -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"inert-allowlist.json"}]'
run_case "S18 inert-allowlist.json -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"bridge-manifest.json"}]'
run_case "S19 bridge-manifest.json -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"scripts/verify-asany.mjs"}]'
run_case "S20 scripts/verify-asany.mjs (baseline внутри) -> red" 1 "$T/sd"
put sd/files_p1.json '[{"filename":"scripts/check-frozen-guard.sh"}]'
run_case "S20b этот харнесс тоже защищён -> red" 1 "$T/sd"

# --- процедура G: метка требует обоснование ---
mk se; put se/files_p1.json '[{"filename":"scripts/lint-baseline.json"}]'
mkpr se BASE HEAD '["frozen-ok"]'
run_case "S21 метка без тела -> red" 1 "$T/se"
mkpr se BASE HEAD '["frozen-ok"]' "$BODY_EMPTY_FIELD"
run_case "S22 метка + пустое поле Ссылка -> red" 1 "$T/se"
mkpr se BASE HEAD '["frozen-ok"]' "$BODY_NO_BULLETS"
run_case "S23 метка + секция без буллетов -> red" 1 "$T/se"
mkpr se BASE HEAD '["frozen-ok"]' "$BODY_OK"
run_case "S24 метка + корректная секция -> green" 0 "$T/se"
mkpr se BASE HEAD '[]' "$BODY_OK"
run_case "S25 корректное тело без метки -> red" 1 "$T/se"

# --- t34: источник данных workflow_run ---
mk sf; put sf/files_p1.json '[{"filename":"src/audio/engine-v3/core/Foo.ts"}]'
run_case "S26 нет ответа GET /pulls -> red" 1 "$T/sf"
put sf/pr.json '{"head":{"sha":"HEAD"},"labels":[],"body":""}'
run_case "S27 в PR нет base.sha -> red" 1 "$T/sf"
mkpr sf BASE HEAD '[]'
run_case "S28 head из события не равен голове PR -> red" 1 "$T/sf" '[{"number":7}]' 'OTHER'
run_case "S29 несколько PR в списке -> берём первый" 1 "$T/sf" '[{"number":7},{"number":9}]'
mkpr sf BASE HEAD '["frozen-ok"]' "$BODY_OK"
run_case "S30 несколько PR + метка -> green" 0 "$T/sf" '[{"number":7},{"number":9}]'

# --- t34 v3: пустой pull_requests при event=pull_request (форк) --------------
# Пропуск здесь был бы зелёным без проверки. Гейт ищет PR по head-коммиту.
mk sg
put sg/files_p1.json '[{"filename":"src/components/Header.tsx"}]'
mkpr sg BASE HEAD '[]'
put sg/commit_pulls.json '[{"number":7,"state":"open","base":{"ref":"main"}}]'
run_case "S31 PR не в списке, но найден по коммиту -> green" 0 "$T/sg" '[]'

put sg/commit_pulls.json '[]'
run_case "S32 PR не в списке и не найден -> red" 1 "$T/sg" '[]'

put sg/commit_pulls.json '[{"number":9,"state":"open","base":{"ref":"release"}}]'
run_case "S33 найденный PR идёт не в main -> red" 1 "$T/sg" '[]'

rm -f "$T/sg/commit_pulls.json"
run_case "S34 поиск по коммиту упал -> red" 1 "$T/sg" '[]'

# --- t36: доставка вердикта на PR через check-runs ---------------------------
# Job-check этого workflow живёт на main, PR его не видит. Вердикт доставляется
# отдельным POST, и проверяются поля тела: name, head_sha, status, conclusion,
# title и summary.
mk sh; put sh/files_p1.json '[{"filename":"src/components/Header.tsx"}]'; mkpr sh BASE HEAD '[]'
run_case "S35 зелёный путь -> exit 0" 0 "$T/sh"
check_case "S35 чек на голове PR" success "$T/sh"

mk si; put si/files_p1.json '[{"filename":"src/audio/engine-v3/core/Foo.ts"}]'; mkpr si BASE HEAD '[]'
run_case "S36 красный путь -> exit 1" 1 "$T/si"
check_case "S36 чек failure" failure "$T/si"

# Скрипт падает до вердикта (API вернул объект вместо массива): чек обязан
# появиться красным, иначе required висел бы в «Expected» вечно.
mk sj; put sj/files_p1.json '{"message":"Bad credentials"}'; mkpr sj BASE HEAD '[]'
run_case "S37 скрипт упал до вердикта -> red" 1 "$T/sj"
check_case "S37 чек failure при падении" failure "$T/sj"

run_case "S38 push -> exit 0" 0 "$T/sj" '[]' '' push
check_case "S38 на push чек не создаётся" none "$T/sj"

run_case "S39 устаревший head -> red" 1 "$T/sh" '[{"number":7}]' OTHER
check_case "S39 чек failure (устарел)" failure "$T/sh" OTHER

echo "---"
echo "PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "ИТОГ: все сценарии совпали"
else
  echo "ИТОГ: есть расхождения"
fi
exit "$FAIL"
