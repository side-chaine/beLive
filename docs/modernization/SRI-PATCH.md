# SRI-PATCH — готовый патч для `index.html`

> ⚠️ СТАТУС на 31.08: НЕ применён — index.html содержит 0 integrity-атрибутов (rg-факт). Применять/закрыть — 🔴 Никиты (SEC-контур).

**Дата:** 2026-08-29 · **Статус:** готов к применению · **Риск:** низкий · **Время:** ~2 минуты

> **Почему отдельным файлом, а не правкой `index.html`:**
> `index.html` на момент написания — **в активной работе Никиты** (`git status` → ` M index.html`).
> Правка чужого рабочего файла создаст конфликт. Здесь — точная вставка, которую можно применить за минуту.

---

## Что чинит

Сейчас 9 скриптов MediaPipe подключены так:

```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        crossorigin="anonymous"></script>
```

Две проблемы:

| # | Проблема | Следствие |
|---|---|---|
| 1 | **Нет `integrity`** | `crossorigin` подготовил запрос к проверке, но проверки нет. Любая подмена файла на CDN исполняется с правами приложения — с доступом к микрофону и сессии |
| 2 | **Нет версии в URL** | CDN отдаёт «последнюю». Сборка невоспроизводима, а без пина SRI — это бомба: файл обновится, хэш перестанет совпадать, **приложение перестанет грузиться** |

**Пункт 2 — не формальность.** Именно поэтому SRI и пин версий делаются **только вместе**.

---

## Применение

Заменить строки **26–34** в `index.html` целиком на блок ниже.

```html
<!-- MediaPipe — SRI + закреплённые версии (ADR-0008). Обновлять вручную, обоими полями. -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js" integrity="sha384-q1KhAZhJcJXr3zfC3Tz07pBqQSabwFIZhXlmlUAB8s0zk4ETWERkIKGBCFQ5Jc3e" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6.1675466023/control_utils.js" integrity="sha384-thKklr83mMkmn5Oz6g4Hjh6DDhvg7+2drGC/ftFqIvpCagFo9sKRttSmILlAEhjO" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js" integrity="sha384-W/7NVG2tfN12ld8faSFVOZ/W4UHFHze98GqEUPTl8EjY9QDwCKQIzoCHp8/IlIIr" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/face_detection.js" integrity="sha384-oO3wOXOXIGBvHXjKwoF69nDtnGjqWIBuT+yCjjIAZmDek7qgjztCwK+WjCuL9O0a" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js" integrity="sha384-nKiz5QrpRlMQLw5nrZcprT7N9vmmAcIgV8TuGuep4x91V4JIPsXa+D44Wxj0guoa" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js" integrity="sha384-oHwoZ9HyKv5ark5VOH+XWdbNfmhYtptAOBuV8plz6mAfXvTA6d8fULuYllWouEK2" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js" integrity="sha384-qcJQ+n/ZcF15Xu2EoRupB4Av+GEAGeW0Td1mp2A90u0NdNLzLYQVMUq1Ax1YAHqk" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/holistic.js" integrity="sha384-uPgv3xhUPhBy7PuniMrm0xGTB8Wme5XMJWg98sFaqvxMAbPeOSa2De2R46nuG8Sw" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/selfie_segmentation.js" integrity="sha384-J/3LshwuX+2viPOY3En4QiZvdvlffDhZYH5MsMuLGdwcoGcYSA7EV1jXFsys0gIb" crossorigin="anonymous"></script>
```

---

## Как получены хэши (воспроизводимо)

```bash
# 1. Версия — из npm-реестра
curl -s https://registry.npmjs.org/@mediapipe/camera_utils/latest \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).version))"

# 2. Файл — с закреплённой версией
curl -sL "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js" -o f.js

# 3. Хэш
node -e "const c=require('crypto'),f=require('fs');\
console.log('sha384-'+c.createHash('sha384').update(f.readFileSync('f.js')).digest('base64'))"
```

Готовый генератор всех девяти: `scripts/generate-sri.sh` (создан в эту же сессию).

> ⚠️ **Хэш должен считаться от того URL, который стоит в `src`.** Если меняешь версию — пересчитывай хэш. Расхождение = браузер **откажется** грузить скрипт.

---

## Проверка после применения

| Проверка | Как |
|---|---|
| Страница грузится | открыть приложение, MediaPipe-фичи работают |
| SRI реально работает | DevTools → Network → подменить ответ скрипта → ожидается ошибка загрузки, а не исполнение |
| Ни один скрипт не «последней версии» | `grep -c 'jsdelivr' index.html` должен показать `@` в каждом URL |

**Откат:** вернуть предыдущие строки 26–34. SRI — атрибут, не изменение кода.

---

## Что дальше

После применения:

1. Добавить `scripts/check-sri.mjs` в CI ([ADR-0008](./ADR-0008-csp-and-security-baseline.md)) — гейт, который проверяет, что каждый CDN-скрипт имеет и `integrity`, и закреплённую версию.
2. Вычеркнуть пункт из [REGISTRY §1](./REGISTRY.md).

> **Это единственная находка всего аудита, которая закрывается за один вечер и не требует архитектурных решений.** Всё остальное (CSP) — длинная игра.
