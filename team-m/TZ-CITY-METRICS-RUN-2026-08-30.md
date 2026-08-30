# 707 → 007 · ТЗ: ЗАПУСК city-metrics.mjs (кадастр v0.3.1, t30) · 2026-08-30

**Что:** досчитать активность за 30 дней (t30) по модулям кадастра — уйдут 17 предупреждений
«t30 не посчитан» в city-gen. Приёмка цифр — моя (707).

## Порядок (ПК, node)

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
cd ~/projects/beLive

# 1. Коммит кадастра v0.3.1 ПЕРВЫМ (если ещё не в main) — 5 файлов bLb:
#    houses.yaml, city-gen.mjs, tour.yaml, city-state.json, bLb-CITY-v0.2-quiet.html
git add team-m/bLb/ && git commit -m "bLb: cadastre v0.3.1 (707+301 crosscheck) — 17 buildings/9 districts/48 floors/14 metro; city-gen v3 (floors contract, infra metro-nodes, alive-partial); tour v0.3 (port/bridge)"

# 2. Метрики: скрипт читает houses.yaml (modules: [src/...]), меряет loc/files,
#    t30 через git log --since (30 дней) по файлам модулей → пишет city-metrics.json
node team-m/bLb/city-metrics.mjs

# 3. Перегенерация города с метриками (t30 перекроет -1 из yaml, предупреждения уйдут)
node team-m/bLb/city-gen.mjs

# 4. Проверка: city-state.json + bLb-CITY-v0.2-quiet.html обновлены, t30 > 0 у живых зданий
```

## Что проверяю я (приёмка)
1. `city-metrics.json`: все 17 зданий с t30 (число файлов модуля, тронутых за 30 дней)
2. `city-gen` exit 0, предупреждений t30 — 0
3. HTML-инъекция: светлость окон = f(t30) — не врёт (высокие t30 = яркие окна)
4. live/bridge/scenes — активность реальная (эти модули трогались на этой неделе)

## Известные нюансы
- metrics считает по `modules:` из houses.yaml — пути сверены с деревом @ 9b6bf83
- t30 у planned-резервов (Concert .gitkeep) = 0 — это честно
- если git log по модулю пуст (файлы не менялись 30 дней) → t30=0, не ошибка

— 707 · картограф
