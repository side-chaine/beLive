# AUDIT_REPORT

**Репозиторий:** side-chaine/beLive
**Ветка аудита:** chore/audit-and-hygiene
**Дата:** YYYY-MM-DD
**Автор аудита:** Gemini Flash / Assistant

## Краткая сводка
- Всего проверено файлов: ...
- Больших файлов (>1MB): N (см. `reports/bigfiles.txt`)
- Битых изображений: M (см. `reports/bad_images.txt`)
- Попаданий на возможные секреты: K (см. `reports/secret_hits.txt`)

## Детали
### 1) Большие файлы
- Файлы и пути: (см. `reports/bigfiles.txt`)
- Рекомендация: перевести в Git LFS или переместить в S3/облачное хранилище.

### 2) Битые медиа
- Список: (см. `reports/bad_images.txt`)
- Действия: восстановление из `origin/main` raw.githubusercontent, либо создание issue с просьбой загрузить оригиналы.

### 3) Секреты
- Найдено совпадений: (см. `reports/secret_hits.txt`)
- Действия: rotate keys, удалить из репо, добавить в GitHub Secrets.

### 4) .gitignore / .gitattributes
- Добавлены/предложены изменения: `.DS_Store`, `node_modules/`, `*.log`, рекомендации Git LFS для медиа.

## Выполненные изменения (commits)
- chore: remove .DS_Store and update .gitignore
- chore: add scripts/check_images.py & basic CI verify job
- chore: add .gitattributes suggestion for git-lfs

## Как тестировать локально
1. `git checkout chore/audit-and-hygiene`
2. `python3 scripts/check_images.py`
3. `./start-local-5501.command` и проверить `http://localhost:5501/index.html`

## Откат изменений
- Для каждого коммита: `git revert <commit>` или `git checkout main -- <file>`

## Рекомендации
- Включить Git LFS для медиаконтента
- Добавить CI job `verify` (см. `.github/workflows/verify-and-deploy.yml`)
- Создать issue для каждого неподдерживаемого/битого медиа-файла
