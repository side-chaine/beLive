# 005 · ВНЕШНЯЯ СВЕРКА ЧЕРНОВИКА-001 «ПУЛЬС-нервная система» · 2026-09-09

**Входы:** черновик PULSE-NERVOUS-2026-09-09-001.md · context7 (kubernetes.io, backstage, alertmanager) + webfetch (erlang.org, sre.google, docs.github.com, docs.nats.io)

## A) Черновик УЖЕ = proven-паттернам (7 совпадений с цитатами)
1. §7.1 verify:mechanisms = K8s reconcile-loop (desired=MAP vs live=CI-grep; kubectl auth reconcile)
2. §4 «поллинг запрещён» = K8s watch/resourceVersion (event-driven heartbeat = наш TRIGGERS-при-CI)
3. §2 ORPHAN + §4 «надгробие не удаляем» = Backstage backstage.io/orphan + «удаление только руками for safety»
4. §4 «2+ эскалации/30 дней, вверх» = OTP MaxR/MaxT (intensity/period; антифлап = «не повышать автоматически»)
5. §7.4 synapse-warn уровень = NATS advisory («JetStream has no dead-letter queue»; «пока никому» легально)
6. §7.5 owner⇔ростер = GitHub CODEOWNERS (несуществующий owner = не назначен) + Backstage owner-валидация
7. Наш урок warn-G-1 = SRE доктрина: «page with robotic response = red flag» → машинный smoke вместо warn — внешний ответ найден.

## B) AMENDMENTS (в черновик)
- **AM-1 →§7.1**: reconcile ДВУСТОРОННИЙ: (a) файл без строки=fail, (b) строка с несуществующим core:=fail; генеративность: L1-кандидат без docs-карты → авто в очередь 007 (chained control loops).
- **AM-2 →§2**: импорты/consumers с флагом source: fact|hyp (Backstage catalog processors дедyцируют связи); гейты сверяют только fact; hyp стареет → перепроверка. Иначе реестр=свалка гипотез.
- **AM-3 →§3**: СОСТОЯНИЕ импульса = 4 золотых сигнала SRE (латентность/трафик/ошибки/насыщенность) → наши 4: ОТКЛИК (CI→импульс latency), ИЗМЕНЧИВОСТЬ (churn+публикации=traffic), АНОМАЛЬНОСТЬ (эскалации=errors), СВЯЗНОСТЬ (сироты/дрейф/hold=saturation). Спец-инварианты — только L1-пилотам.
- **AM-4 →§7.4**: warn-ловушка NATS (advisible транзиентен, «if no one subscribed when it fires» — фикс: durable destination) → synapse-warn ПИШЕТСЯ в durable LOG (у нас есть — DIAGNOSTICS/LOG зоны), не только консоль CI.
- **AM-5 →§1/§6**: Backstage owner-as-metadata: L2 «кластер-агент» понизить до ПОЛЯ family: (живых L2 на старте = НОЛЬ, агент включается при эскалации семьи). Экономика: 6 L1 + реестровые семьи.

## C) Отвергнуто: OTP живые supervision-дерева (=наш поллинг-грех), Alertmanager routing-tree (оверкилл для CI-потока), Backstage как платформа (нужен скелет формата), NATS-stream для warn (LOG-файл закрывает).

## D) Не найдено честно: «generative controller» как именованный термин (функция в AM-1 без имени); CloudEvents DLQ (лимит запросов); alertmanager-семантика уровней (взята из SRE-главы).

— 005 · к стрессу готовы: жир §5 пилот и §7 гейты (тема прогона А не тронута)
