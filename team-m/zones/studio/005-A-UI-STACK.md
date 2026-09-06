# 005-A · UI-стек StudioSurface ( Context7-разведка) · этап-2 прогона Studio

**Дата:** 2026-09-06 · **Автор:** 005-A (исследователь UI) · **Статус:** сдано 001/диспетчеру
**Вердикт-стек:** `@base-ui/react@^1.8.0` (НЕ deprecated `@base-ui-components/react`) — Slider (vertical, ориентация из коробки, клавиатура Arrow/PageUp/Home/End верифицирована исходниками и тестами) + Meter (headless VU, role="meter", aria-valuetext) + Toggle/ToggleGroup (M/S-пара, roving focus). ОДНА зависимость вместо 3-4 radix-пакетов; Meter у Radix отсутствует как класс; sideEffects:false + точечные экспорты ./slider ./meter ./toggle ./toggle-group + Vite = в бандл идёт только использованное; peer react ^19 (наш 19.2.4 ✅).

## Ключевые факты
- **F1-F4:** Radix Slider vertical — официальный, но для полного стека нужен 2-й пакет; Base UI Indicator сам ставит bottom/height + CSS-переменные --start-position/--relative-size (паттерн «окно в градиент» без JS); официальный vertical CSS Module-референс в доках Base UI.
- **F5:** Base UI Meter = Root/Track/Indicator/Value/Label — готовый headless VU.
- **F7:** переименование пакета задокументировано registry API; v1.8.0 стабильная.
- **F8:** react-rangesler — МЁРТВ (9 лет, class-компоненты) — отпадает.
- **F9:** в репо UI-библиотек нет вообще → любая новая = новая зависимость; VU-градиент `#4ade80→#facc15→#ef4444` УЖЕ есть (MixerPanel.module.css:115-125, тиры solid/gradient/gradient-peak); glow-прецедент box-shadow в RehearsalLyrics.module.css:256.
- **F10:** composition через className(state)-функции — «фейдер + VU-столбец» в одном ChannelStrip без хаков.

## Три CSS-паттерна «fill до ручки»
- **A. Сжатый градиент** (текущий meterFill-паттерн) — градиент сжимается со значением. Проще всех, уже в репо.
- **B. Двойной трек («окно»)** — полный градиент + слой затемнения `bottom: var(--start-position)` — градиент фиксирован, окно растёт с ручкой. На Base UI Indicator готово.
- **C. clip-path/mask** — один элемент, градиент неподвижен: `clip-path: inset(0 0 calc(100% - var(--fill)) 0)`.

## Стек (итог)
```
Полоса: label + Base UI Slider (vertical, ручка-капля CSS, glow box-shadow) + Base UI Meter (VU, градиент репо) + ToggleGroup M/S (≥44px CSS)
Карточка плагина: div-карточка (прецедент InstrumentCard 80px/hero 96px/--stem-energy) + Toggle (enable) + Slider (mini-регулятор)
Верификация бандла: npm run probe:bundle после POC-инсталла, ДО мержа (обход bundlephobia-400)
Radix Slider = запасной (API-модель идентична)
```

**НЕ НАЙДЕНО:** готового headless Card-компонента (не нужен — div + прецедент InstrumentCard) · OpenDAW 404 (web-DAW референсы из доков) · точного gzip-размера (обход = probe:bundle).

**Полный отчёт 005-A:** в LOG-цепи прогона (task ses_f87a27f4cffeF6bcaj54nzgdkH); источники: Context7 /mui/base-ui (исходники SliderThumb/SliderRoot.test), /radix-ui/website, /shadcn-ui/ui, npm registry API.
