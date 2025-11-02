# PR: chore: audit repo & hygiene — add image-check, .gitattributes, CI verify

## Что сделано
- Добавлен `scripts/check_images.py` + сохранение отчётов в `reports/`
- Добавлен `.gitattributes` рекомендация для Git LFS
- Обновлён `.gitignore` (удалены `.DS_Store` и т.п.)
- Добавлен workflow verify (только проверка: images, pytest)
- AUDIT_REPORT.md (шаблон) добавлен в корень

## Почему
Подготовка репозитория к публичному размещению на GitHub + защита от случайного коммита больших бинарников и битых медиа.

## Как протестировать
1. Локально: `python3 scripts/check_images.py` — должен вернуть 0 и создать `reports/bad_images.txt` при ошибках.
2. Запустить `./start-local-5501.command` и проверить индекс

## Чек-лист
- [ ] Скрипт image-check проходит
- [ ] Нет секретов в коммитах
- [ ] CI verify запускается
