# Важно: репозиторий обновлён (history rewritten)

Мы очистили историю (удалили старые большие изображения в Docs/screenshots, Docs/loop-learn и Karaoke/*.jpg).
This rewrote history — everyone must re-clone the repository.

Рекомендуемый (чистый) путь:
  git clone https://github.com/side-chaine/beLive.git
  cd beLive

Если у вас есть локальные изменения:
  # в старом репо сделайте патч:
  git format-patch origin/main..my-branch
  # затем в новом репо примените патч:
  git am ../patch-*.patch

Если нужна помощь — создавайте Issue с меткой "help-needed" или пишите в Telegram.
