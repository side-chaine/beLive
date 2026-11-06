import type { HintLocale, HintVariant } from './types';

/**
 * Copy pool for `start.catalog` — 7 RU + 7 EN.
 *
 * One variant is chosen per load and it is never the same as the previous
 * load (see store.pickVariantIndex). No imperatives, no countdowns, no
 * "you must": the hint only shows where a next step EXISTS.
 */
export const START_CATALOG_VARIANTS: Record<HintLocale, HintVariant[]> = {
  ru: [
    { line: 'Можно начать вот отсюда', poke: 'ТЫК !', aside: 'каталог' },
    { line: 'Здесь живут треки', poke: 'ТЫК !', aside: 'без спешки' },
    { line: 'Первый шаг — каталог', poke: 'СЮДА !', aside: 'дальше само пойдёт' },
    { line: 'Загляни, когда будешь готов', poke: 'ТЫК !', aside: 'ни к чему не обязывает' },
    { line: 'Всё начинается с одного трека', poke: 'ВОТ !', aside: 'каталог' },
    { line: 'Дверь в музыку — тут', poke: 'ТЫК !', aside: 'можно просто посмотреть' },
    { line: 'Тихо подсказываю: сюда', poke: 'ТЫК !', aside: 'каталог' },
  ],
  en: [
    { line: 'You can start right here', poke: 'TAP !', aside: 'the catalog' },
    { line: 'This is where the tracks live', poke: 'TAP !', aside: 'no rush' },
    { line: 'First stop: the catalog', poke: 'THIS WAY !', aside: 'the rest follows' },
    { line: 'Whenever you are ready', poke: 'TAP !', aside: 'nothing to commit' },
    { line: 'It all starts with one track', poke: 'HERE !', aside: 'the catalog' },
    { line: 'The door into beLive', poke: 'TAP !', aside: 'just a look is fine' },
    { line: 'Quietly pointing over here', poke: 'TAP !', aside: 'the catalog' },
  ],
};

/**
 * Copy pool for `catalog.upload` — 7 RU + 7 EN.
 *
 * Same voice as the start nudge: an invitation, never an instruction. The word
 * «первый» only appears where it is TRUE (empty catalog); other lines stay
 * valid when the user already has tracks and we are showing the step again
 * within the exposure budget.
 */
export const UPLOAD_TAB_VARIANTS: Record<HintLocale, HintVariant[]> = {
  ru: [
    { line: 'Первый трек начинается тут', poke: 'СЮДА !', aside: 'загрузка' },
    { line: 'Можно закинуть что-то своё', poke: 'ТЫК !', aside: 'без спешки' },
    { line: 'Пока пусто — вот дверь', poke: 'ВОТ !', aside: 'загрузка' },
    { line: 'Здесь появляется музыка', poke: 'ТЫК !', aside: 'можно просто посмотреть' },
    { line: 'До трека — одна вкладка', poke: 'СЮДА !', aside: 'дальше само пойдёт' },
    { line: 'Тихо показываю: загрузка', poke: 'ТЫК !', aside: 'ни к чему не обязывает' },
    { line: 'С чего начинается репетиция', poke: 'ВОТ !', aside: 'с одного трека' },
  ],
  en: [
    { line: 'Your first track starts here', poke: 'THIS WAY !', aside: 'upload' },
    { line: 'You could drop something of your own', poke: 'TAP !', aside: 'no rush' },
    { line: 'Empty so far — here is the door', poke: 'HERE !', aside: 'upload' },
    { line: 'This is where music appears', poke: 'TAP !', aside: 'just a look is fine' },
    { line: 'One tab between you and a track', poke: 'THIS WAY !', aside: 'the rest follows' },
    { line: 'Quietly pointing at upload', poke: 'TAP !', aside: 'nothing to commit' },
    { line: 'Where a rehearsal begins', poke: 'HERE !', aside: 'with one track' },
  ],
};
