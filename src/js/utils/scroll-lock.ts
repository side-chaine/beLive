let locked = false;
let scrollY = 0;

export function lockScroll() {
  if (locked) return;
  locked = true;
  scrollY = window.scrollY || window.pageYOffset;

  // 1) стабилизуем ширину: резервируем место под скроллбар всегда
  document.documentElement.style.scrollbarGutter = "stable both-edges";

  // 2) фиксируем body, не скрывая скроллбар у корня
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

export function unlockScroll() {
  if (!locked) return;
  locked = false;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  // Возвращаем на прежнее место
  window.scrollTo(0, scrollY);

  // Можно оставить стабильный gutter глобально:
  // document.documentElement.style.scrollbarGutter = "";
}
