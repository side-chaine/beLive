# Спецификация моста Mac ⇄ ПК (beLive Unified OpenCode)

> 🗄️ **HISTORICAL (redirect 30.08):** этот док закрыт. Живая правда — `team-m/SHARED-REGISTRY.md §0 (топология, роли, протоколы канала — живой SSOT)`. Карта вердиктов — `team-m/DOC-SYNC-MAP-2026-08-30.md`.

> Статус: активно с 2026-08-23. Автор: агент 007.
> См. также: `docs/SYNC-PROTOCOL.md`, отчёт Мак-агента «СИСТЕМА ЕДИНА (v3)».

## 1. Назначение
Единая система из двух инстансов OpenCode: **ПК — канонический хост репозитория**, **Мак — сателлит**.
Оба работают над одним проектом `beLive` как над единым целым: правка на одной стороне мгновенно
видна на другой.

## 2. Топология сети
| Узел | IP | Примечание |
|---|---|---|
| Роутер | 192.168.0.1 | — |
| Мак (macOS, en0) | 192.168.0.13 | сателлит |
| ПК (WSL2 Ubuntu, mirrored) | 192.168.0.14 | MAC `b4:e:de:60:e:dc`; хост в сети, sshd слушает :22 |

## 3. Транспорт: SSH + SSHFS
### 3.1 SSH на ПК
- `sshd` в WSL2 под управлением systemd: `ssh.service` **enabled + active** (переживает ребут WSL).
- Фаервол Windows: правило `sshd-wsl` (Inbound, TCP/22, Allow, Profile=Any).
- Hyper-V/WSL фаервол: `DefaultInboundAction Allow` (иначе WSL-трафик блокируется отдельным слоем).
- Авторизация по ключу: публичный ed25519-ключ Мака прописан в `~/.ssh/authorized_keys` на ПК.

### 3.2 Монтаж на Маке
- FUSE-T 1.2.7 (kext-less, без перезагрузки) + sshfs 2.9.
- Алиас `bepc` в `~/.ssh/config`:
  ```
  Host bepc
    HostName 192.168.0.14
    User nikit
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 15
  ```
- Монтаж:
  ```bash
  sshfs bepc:/home/nikit/projects/beLive ~/beLive-pc \
    -o defer_permissions,reconnect,ServerAliveInterval=15,volname=beLive-PC
  ```
- `~/beLive-pc` — **живая ссылка** на ПК-ФС (НЕ отдельный клон).

## 4. Протокол синхронизации
- ПК каноничен. Мак работает **только внутри `~/beLive-pc`**. Никаких отдельных `git clone` на Маке.
- **Файлы** видны мгновенно (sshfs отражает ПК-ФС в реальном времени).
- **Сводка состояния** — `REPO-STATE.md` в корне проекта, авто-генерируется git-хуком
  (`post-commit` / `post-merge` / `post-checkout`) при каждом коммите. Содержит: ветка, HEAD,
  последний коммит (msg/author/date), число незакоммиченных изменений, последние 5 коммитов.
- Для незакоммиченного состояния Мак выполняет `git status` / `git diff` прямо в монтаже.
- `REPO-STATE.md` добавлен в `.gitignore` (не грязнит дерево коммита).

## 5. Облачный бэкап (GitHub)
- `origin`: `git@github.com:side-chaine/beLive.git` (SSH, ключ зарегистрирован в аккаунте).
- Бэкап-ветка: `backup/win-V3-finish_2-2026-08-23` (шаблон `backup/win-<ветка>-<дата>`).
- 🔒 **Push/деплой заблокирован до полной V3-миграции на локалке.** Исключение (scoped override):
  только бэкап-ветка.
- Перед бэкапом: скан `opencode.json` на типичные секреты (`sk-`, `ghp_`, `AKIA`, …) — при нахождении
  исключается; временные `.tmp-frames/` игнорируются через `.gitignore`.

## 6. Frozen Zone (обе стороны, без исключений)
Не трогать: `src/audio/core/AudioEngineV2.ts`, `src/audio/compat/patchV1.ts`, `src/bridges/*`,
`src/services/track.orchestrator.ts`, приватные поля `_`.
Архитектурные решения (в т.ч. снятие frozen-статуса) — только через агента **007** + OVERRIDE от Центра.

## 7. Роли
- **ПК (007):** каноничный хост, упаковка контекста (MEGA-PACK), координация субагентов, dispatch.
- **Мак (Sonnet / разведка):** сателлит, работа в смонтированной ФС, разведка кодовой базы, вторая ветка.

## 8. Риски и восстановление
| Риск | Действие |
|---|---|
| IP `.14` сменился | зарезервировать DHCP по MAC `b4:e:de:60:e:dc` на роутере / использовать mDNS |
| Обрыв sshfs | флаги `reconnect`+`keepalive` уже в монтаже; перемонтировать: `umount ~/beLive-pc && sshfs bepc:... ~/beLive-pc ...` |
| sshd упал | `sudo service ssh start` (systemd поднимет автоматически после ребута) |
| Фаервол сброшен | пересоздать `sshd-wsl` (Inbound Allow) + Hyper-V `DefaultInboundAction Allow` (см. §3.1) |

## 9. Критерий работоспособности
- `ls ~/beLive-pc/README.md` читается на Маке.
- Правка, сделанная на ПК, видна в `git status` на Маке.
- `cat ~/beLive-pc/REPO-STATE.md` показывает актуальный HEAD после коммита на ПК.
