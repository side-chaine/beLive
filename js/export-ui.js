// js/export-ui.js
class ExportUI {
  constructor({ exporter, blockLoopControl }) {
    this.exporter = exporter;
    this.blockLoopControl = blockLoopControl;
    // this.selected = new Set(); // id блоков (строковые) - УДАЛЕНО: используем _selectedIds
    this.isMode = false;
    this.btn = null;
    this.modal = null;
    // this._wagonHandler = null; // Для хранения ссылки на обработчик - УДАЛЕНО: используем _captureHandlers

    // 🎯 НОВОЕ: Свойства для логики поезда и захвата событий (из рекомендаций Нейросовета)
    this._trainContainer = null;
    this._trainObserver = null;
    this._captureHandlers = [];
    this._selectedIds = new Set(); // Теперь ExportUI управляет набором ID выбранных блоков

    console.log('ExportUI: Конструктор вызван.');
    // Переносим инициализацию кнопки и модалки в конструктор
    this._initUI();
    this._bindModeChanges();
  }

  _initUI() {
    console.log('ExportUI: _initUI вызван. Текущий this.btn:', this.btn);
    // Если кнопка уже создана, ничего не делаем
    if (this.btn) return;

    const tryCreateButton = () => {
      console.log('ExportUI: tryCreateButton вызван.');
      const panel = document.querySelector('.header-content.glass-effect');
      if (panel) {
        console.log('✅ ExportUI: Найден контейнер .header-content.glass-effect');
        const bpmControls = panel.querySelector('.bpm-controls');
        if (!bpmControls) {
          console.error('ExportUI: Не найден контейнер .bpm-controls для позиционирования кнопки.');
          return false; // Возвращаем false, так как создание не удалось
        }

        this.btn = document.createElement('button');
        this.btn.className = 'glass-btn export-blocks-btn';
        this.btn.textContent = 'Export Blocks';
        this.btn.title = 'Экспорт выделенных блоков';
        this.btn.onclick = () => this.toggle();
        bpmControls.appendChild(this.btn); // Вставляем кнопку ВНУТРЬ BPM controls

        this.modal = document.createElement('div');
        this.modal.className = 'export-mini';
        this.modal.innerHTML = `
          <div class="export-mini__row">
            <button class="mini-opt" data-type="prechorus">Pre-Chorus All</button>
            <button class="mini-opt" data-type="verse">Verse All</button>
            <button class="mini-opt" data-type="chorus">Chorus All</button>
            <button class="mini-opt" data-type="bridge">Bridge All</button>
            <button class="mini-opt" data-type="intro">Intro All</button>
            <button class="mini-opt" data-type="outro">Outro All</button>
          </div>
          <div class="export-mini__row">
            <button class="mini-confirm">Render</button>
            <button class="mini-cancel">Cancel</button>
          </div>
          <div class="export-mini__hint">Можно кликать по блокам на панели сверху для точного выбора</div>
        `;
        this.modal.style.display = 'none';
        // Вставляем модалку как прямой потомок body для корректного позиционирования
        document.body.appendChild(this.modal);

        this.modal.querySelectorAll('.mini-opt').forEach(b => {
          b.onclick = () => this._selectType(b.dataset.type);
        });
        this.modal.querySelector('.mini-confirm').onclick = () => this._confirm();
        this.modal.querySelector('.mini-cancel').onclick = () => this._cancel();

        console.log('✅ ExportUI: Кнопка и модалка успешно созданы.');
        // Если мы уже в режиме репетиции, сразу показываем кнопку
        this._updateVisibility();

        return true; // Успешно создано
      } else {
        console.warn('⚠️ ExportUI: Контейнер .header-content.glass-effect еще не доступен.');
        return false; // Еще не готово
      }
    };

    if (!tryCreateButton()) {
      console.log('ExportUI: tryCreateButton вернул false. Активируем MutationObserver.');
      // Если не удалось создать сразу, ждем появления контейнера
      const observer = new MutationObserver((mutations, obs) => {
        console.log('ExportUI: MutationObserver сработал.');
        if (tryCreateButton()) {
          console.log('ExportUI: Кнопка создана через MutationObserver.');
          obs.disconnect(); // Отключаем observer после успешного создания
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  _bindModeChanges() {
    console.log('ExportUI: _bindModeChanges вызван.');
    const observer = new MutationObserver(() => this._updateVisibility());
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  _updateVisibility() {
    console.log('ExportUI: _updateVisibility вызван.');
    const isRehearsalMode = document.body.classList.contains('mode-rehearsal');
    const bpmControls = document.querySelector('.bpm-controls');
    console.log('ExportUI: _updateVisibility - isRehearsalMode:', isRehearsalMode, 'bpmControls:', bpmControls);
    
    if (this.btn && this.modal) {
      this.btn.style.display = isRehearsalMode ? 'block' : 'none';
      console.log('ExportUI: Кнопка экспорта - display:', this.btn.style.display);
      // Если кнопка становится невидимой, скрываем и модалку
      if (!isRehearsalMode && this.modal.style.display !== 'none') {
        this.modal.style.display = 'none';
        console.log('ExportUI: Модалка - display:', this.modal.style.display);
      }
    }
    if (bpmControls) {
      bpmControls.style.display = isRehearsalMode ? 'flex' : 'none';
      console.log('ExportUI: BPM Controls - display:', bpmControls.style.display);
    }
  }

  toggle() {
    if (!this.btn) {
      console.error('ExportUI: Кнопка экспорта не инициализирована.');
      return;
    }

    if (!this.isMode) {
      this._enter();
    } else {
      // Если режим экспорта уже активен, повторное нажатие на кнопку должно отменять режим, а не подтверждать экспорт.
      this._cancel(); 
    }
  }

  async _enter() {
    // 1) включаем флаг сразу
    window.AppConstants.__EXPORT_SELECT_MODE__ = true;

    console.log('ExportUI: _enter вызван. __EXPORT_SELECT_MODE__:', window.AppConstants.__EXPORT_SELECT_MODE__);

    if (!this.btn || !this.modal) {
      console.error('ExportUI: Кнопка или модалка не инициализированы при попытке входа в режим.');
      this._initUI();
      if (!this.btn || !this.modal) return;
    }

    this.isMode = true;
    this.btn.classList.add('active');
    this.modal.style.display = 'block';

    // 2) найдём контейнер поезда
    this._trainContainer = document.querySelector('.loop-train');
    if (!this._trainContainer) {
      console.warn('ExportUI: loop-train container not found. Trying to find it in 300ms...');
      // Дополнительная попытка найти контейнер через небольшой таймаут, если он не сразу доступен
      await new Promise(resolve => setTimeout(() => {
        this._trainContainer = document.querySelector('.loop-train');
        resolve();
      }, 300));
      if (!this._trainContainer) {
        console.error('ExportUI: loop-train container still not found after delay. Export selection may not work correctly.');
        // Продолжаем, чтобы модалка хотя бы открылась, но функционал будет ограничен
      }
    }

    // 3) дождёмся «стабильного» DOM поезда (иначе повиснем на старых вагонах)
    if (this._trainContainer) {
      console.log('ExportUI: Ожидаем стабильности поезда...');
      await this._waitForStableTrain(this._trainContainer, 2);
      console.log('ExportUI: Поезд стабилен.');
    }

    // 4) навесим capture-обработчики на контейнер
    this._attachCaptureHandlers(this._trainContainer);

    // 5) наблюдатель на перерисовку — чтобы перекидывать подсветку
    this._observeTrainMutations(this._trainContainer);

    // 6) первая отрисовка подсветки
    this._applyHighlightToCurrentWagons();

    // 🎯 НОВОЕ: Устанавливаем атрибут на контейнер поезда для CSS
    this._trainContainer?.setAttribute('data-export-select', '1');
    // Сбрасываем фокус, чтобы браузер не рисовал focus-ring на кнопках
    const active = document.activeElement;
    if (active && active.closest && active.closest('.loop-train')) {
      try { active.blur(); } catch(_) {}
    }

    // Оповещаем BlockLoopControl о входе в режим экспорта
    this.blockLoopControl?.setExportSelectionMode(true);

    // Оригинальные логи (убраны или перенесены по необходимости)
    // console.log(`ExportUI: _enter - Количество выбранных блоков перед обновлением: ${this.selected.size}`);
    // const allWagonsCount = document.querySelectorAll('.loop-wagon').length;
    // console.log(`ExportUI: _enter - Найдено ${allWagonsCount} .loop-wagon элементов в DOM перед updateExportSelectionDisplay.`);
    // this.updateExportSelectionDisplay(); // Это теперь часть _applyHighlightToCurrentWagons()
  }

  _cancel() {
    // 1) выключаем флаг
    window.AppConstants.__EXPORT_SELECT_MODE__ = false;

    console.log('ExportUI: _cancel вызван. __EXPORT_SELECT_MODE__:', window.AppConstants.__EXPORT_SELECT_MODE__);

    this.isMode = false;
    if (this.btn) {
      this.btn.classList.remove('active');
    }
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    document.body.classList.remove('export-mode-on');

    // 2) снимаем capture-хендлеры
    this._detachCaptureHandlers(this._trainContainer);

    // 3) убираем observer
    if (this._trainObserver) { try { this._trainObserver.disconnect(); } catch (_) {} this._trainObserver = null; }

    // 4) очистка подсветки
    this._clearHighlight();
    // 🎯 НОВОЕ: Удаляем атрибуты data-export-selected со всех вагонов при выходе
    if (this._trainContainer) {
      this._trainContainer.querySelectorAll('.loop-wagon[data-export-selected]')
        .forEach(w => w.removeAttribute('data-export-selected'));
      // 🎯 НОВОЕ: Удаляем атрибут с контейнера поезда для CSS
      this._trainContainer.removeAttribute('data-export-select');
    }

    // Оповещаем BlockLoopControl о выходе из режима экспорта
    this.blockLoopControl?.setExportSelectionMode(false);

    // Оригинальная логика, которую нужно удалить или перенести
    // if (this.blockLoopControl) {
    //   this.blockLoopControl._renderLoopTrain(); // Восстанавливаем обработчики BlockLoopControl
    // }
    // this._wireTrain(false); // Деактивируем обработчик кликов по вагонам
  }

  async _confirm() {
    console.log('ExportUI: _confirm вызван. isMode:', this.isMode);
    if (!this.isMode) return;
    if (!this.btn || !this.modal) {
      console.error('ExportUI: Кнопка или модалка не инициализированы при попытке подтверждения.');
      return;
    }

    // 🎯 НОВОЕ: Проверка наличия экспортера и его методов
    if (!this.exporter || typeof this.exporter.exportBlocksRealtime !== 'function') {
      console.error('ExportUI: exporter not ready');
      window.app?.showNotification?.('Экспорт недоступен (экспортер не готов)', 'error');
      return;
    }

    const blockIds = Array.from(this._selectedIds || []);
    if (!blockIds.length) {
      window.app?.showNotification?.('Не выбраны блоки', 'warning');
      return;
    }

    const rate = (window.app?.audioEngine?.playbackRate || 1.0);
    const vocalGain = window.app?.audioEngine?.vocalsGainNode?.gain.value || 1;
    const instrumentalGain = window.app?.audioEngine?.instrumentalGainNode?.gain.value || 1;

    this.modal.style.display = 'none';
    this.btn.disabled = true;
    this.btn.textContent = 'Rendering…';

    try {
      console.log('[ExportUI] calling exporter.exportBlocksRealtime', { blockIds, rate, vocalGain, instrumentalGain });

      const res = await this.exporter.exportBlocksRealtime({
        blockIds: blockIds,
        rate: rate,
        vocalGain: vocalGain,
        instrumentalGain: instrumentalGain,
        format: 'mp3',
        bitrate: 192,
        onProgress: (p) => {
          const bar = this.modal.querySelector('.export-mini__progress .bar');
          if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        }
      });

      if (res?.blob) {
        const filename = res.filename || 'export.mp3';
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        console.log('[ExportUI] download started:', filename);
        window.app?.showNotification?.(`Экспорт "${filename}" завершен!`, 'success');
      } else {
        console.warn('[ExportUI] exporter returned no blob', res);
        window.app?.showNotification?.('Экспорт завершился без файла', 'warning');
      }

      this.btn.textContent = 'Done';
      setTimeout(() => {
        this.btn.textContent = 'Export Blocks';
        this.btn.disabled = false;
        this._cancel();
      }, 1200);

    } catch (e) {
      console.error('[ExportUI] export failed', e);
      window.app?.showNotification?.(`Ошибка экспорта: ${e.message || String(e)}`, 'error');
      this.btn.textContent = 'Error';
      setTimeout(() => {
        this.btn.textContent = 'Export Blocks';
        this.btn.disabled = false;
        this._cancel();
      }, 1200);
    } finally {
      // не закрываем модалку, чтобы видеть результат/логи
    }
  }

  _selectType(type) {
    console.log(`ExportUI: _selectType вызван для типа: ${type}`);

    const allBlocks = this.blockLoopControl?.lyricsDisplay?.textBlocks || [];
    const blocksOfType = allBlocks.filter(block => {
      const blockIdType = (block.type || '').toLowerCase();
      const blockName = (block.name || '').toLowerCase();
      return blockIdType.includes(type.toLowerCase()) || blockName.includes(type.toLowerCase());
    });

    if (blocksOfType.length === 0) {
      console.log(`ExportUI: Нет блоков типа '${type}' для выбора.`);
      return;
    }

    // Проверяем, все ли блоки данного типа уже выбраны
    const areAllSelected = blocksOfType.every(block => this._selectedIds.has(String(block.id)));

    if (areAllSelected) {
      // Если все выбраны, снимаем выделение со всех
      console.log(`ExportUI: Снимаем выделение со всех блоков типа '${type}'.`);
      blocksOfType.forEach(block => {
        const id = String(block.id);
        this._selectedIds.delete(id);
      });
    } else {
      // Если не все выбраны (или ни один), выбираем все
      console.log(`ExportUI: Выбираем все блоки типа '${type}'.`);
      blocksOfType.forEach(block => {
        const id = String(block.id);
        this._selectedIds.add(id);
      });
    }

    // 🎯 НОВОЕ: После изменения _selectedIds, обновляем визуальное состояние через _applyHighlightToCurrentWagons()
    this._applyHighlightToCurrentWagons();

    console.log(`ExportUI: Текущий выбранный список: ${this._selectedIds.size}`);
  }

  // УДАЛЕНО: updateExportSelectionDisplay() - заменено на _applyHighlightToCurrentWagons()

  // ————— helpers (из рекомендаций Нейросовета) —————

  _waitForStableTrain(container, idleFrames = 2) {
    if (!container) return Promise.resolve();
    return new Promise(resolve => {
      let last = container.childElementCount;
      let idle = 0;
      const tick = () => {
        const now = container.childElementCount;
        if (now === last) {
          idle++;
          if (idle >= idleFrames) return resolve();
        } else {
          idle = 0;
          last = now;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  _attachCaptureHandlers(container) {
    if (!container) return;

    const swallowToggle = (e) => {
      if (!window.isExportSelectMode || !window.isExportSelectMode()) return false;
      const t = e.target;
      if (!t) return false;
      // если клик по toggle или внутри неё — гасим насмерть
      if (t.closest && t.closest('.wagon-loop-toggle')) {
        e.preventDefault?.();
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
        return true;
      }
      return false;
    };

    const handler = (e) => {
      console.log('ExportUI: Capture handler - Клик/нажатие обнаружено.', { type: e.type, target: e.target.className });
      if (!window.isExportSelectMode()) {
        console.log('ExportUI: Capture handler - Режим экспорта неактивен, пропускаем.');
        return;
      }
      if (swallowToggle(e)) return;

      const wagon = e.target.closest('.loop-wagon');
      if (!wagon) {
        console.log('ExportUI: Capture handler - Элемент не является вагоном, пропускаем.');
        return;
      }
      console.log('ExportUI: Capture handler - Клик по вагону.', { blockId: wagon.dataset.blockId, type: e.type });

      // режем всё чужое
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      console.log('ExportUI: Capture handler - Событие предотвращено и остановлено.');

      const id = wagon.dataset.blockId || wagon.getAttribute('data-block-id') || wagon.id;
      if (!id) {
        console.warn('ExportUI: Capture handler - Не удалось получить ID блока для вагона.', wagon);
        return;
      }

      // toggle в набор
      if (this._selectedIds.has(id)) {
        this._selectedIds.delete(id);
        console.log(`ExportUI: Capture handler - Блок ${id} удален из _selectedIds. Текущий список: ${Array.from(this._selectedIds).join(', ')}`);
      } else {
        this._selectedIds.add(id);
        console.log(`ExportUI: Capture handler - Блок ${id} добавлен в _selectedIds. Текущий список: ${Array.from(this._selectedIds).join(', ')}`);
      }

      this._applyHighlightToCurrentWagons();
      console.log('ExportUI: Capture handler - Вызван _applyHighlightToCurrentWagons.');
      // если нужно — обновить summary/счётчик
    };
    // расширяем список событий, чтобы ни один toggle не просочился
    const events = [
      'pointerdown','pointerup',
      'mousedown','mouseup',
      'click',
      'touchstart','touchend',
      'keydown' // Space/Enter по кнопке
    ];
    events.forEach(evt => {
      container.addEventListener(evt, handler, { capture: true, passive: false });
      this._captureHandlers.push({ evt, fn: handler });
    });
  }

  _detachCaptureHandlers(container) {
    if (!container) return;
    for (const { evt, fn } of this._captureHandlers) {
      try {
        container.removeEventListener(evt, fn, true);
      } catch (_) {}
    }
    this._captureHandlers = [];
  }

  _observeTrainMutations(container) {
    if (!container) return;
    console.log('ExportUI: Инициализация MutationObserver для контейнера поезда.', container);
    this._trainObserver = new MutationObserver((muts) => {
      console.log('ExportUI: MutationObserver сработал.', { muts: muts.length + ' мутаций', isExportSelectMode: window.isExportSelectMode() });
      let needRepaint = false;
      for (const m of muts) {
        if (m.type === 'childList') { needRepaint = true; break; }
        // игнорируем attributes
      }
      if (needRepaint) {
        this._applyHighlightToCurrentWagons();
        console.log('ExportUI: MutationObserver - Вызван _applyHighlightToCurrentWagons после мутации childList.');
      }
    });
    this._trainObserver.observe(container, { childList: true, subtree: false }); // attributes:false
  }

  _applyHighlightToCurrentWagons() {
    console.log('ExportUI: _applyHighlightToCurrentWagons вызван.');
    if (!this._trainContainer) {
      console.warn('ExportUI: _applyHighlightToCurrentWagons - _trainContainer не найден.');
      return;
    }
    const wagons = this._trainContainer.querySelectorAll('.loop-wagon');
    const allBlocks = this.blockLoopControl?.lyricsDisplay?.textBlocks || [];
    const blockMap = new Map(allBlocks.map(block => [String(block.id), block]));

    console.log(`ExportUI: _applyHighlightToCurrentWagons - Найдено ${wagons.length} вагонов. Selected IDs: ${Array.from(this._selectedIds).join(', ')}`);
    wagons.forEach(w => {
      const id = w.dataset.blockId || w.getAttribute('data-block-id') || w.id;
      if (!id) {
        console.warn('ExportUI: _applyHighlightToCurrentWagons - Вагон без ID.', w);
        return;
      }

      // 🎯 НОВОЕ: Определяем тип блока и применяем соответствующий класс
      const blockData = blockMap.get(id);
      const blockType = blockData?.type || 'verse'; // По умолчанию 'verse'

      // Удаляем все предыдущие классы типов
      w.classList.remove(
        'block-type-verse', 'block-type-chorus', 'block-type-bridge',
        'block-type-prechorus', 'block-type-intro', 'block-type-outro', 'block-type-blank'
      );
      // Добавляем новый класс типа
      if (blockType !== 'unknown' && blockType !== 'default') {
        w.classList.add(`block-type-${blockType}`);
      }

      const hasHighlight = this._selectedIds.has(id);
      const isCurrentlyHighlighted = w.hasAttribute('data-export-selected');

      if (hasHighlight && !isCurrentlyHighlighted) {
        w.setAttribute('data-export-selected', '1');
      } else if (!hasHighlight && isCurrentlyHighlighted) {
        w.removeAttribute('data-export-selected');
      }
    });
    console.log('ExportUI: _applyHighlightToCurrentWagons завершен.');
  }

  _clearHighlight() {
    if (!this._trainContainer) return;
    this._trainContainer.querySelectorAll('.loop-wagon[data-export-selected]')
      .forEach(w => w.removeAttribute('data-export-selected'));
    // 🎯 НОВОЕ: Также удаляем классы типов при очистке выделения
    this._trainContainer.querySelectorAll('.loop-wagon').forEach(w => {
      w.classList.remove(
        'block-type-verse', 'block-type-chorus', 'block-type-bridge',
        'block-type-prechorus', 'block-type-intro', 'block-type-outro', 'block-type-blank'
      );
    });
    this._selectedIds.clear();
  }

  // _handleWagonClick(e) {
  //   console.log('ExportUI: _handleWagonClick вызван. isMode:', this.isMode);
  //   e.stopPropagation(); // 🎯 НОВОЕ: Предотвращаем всплытие события, чтобы избежать конфликтов
  //   const w = e.target.closest('.loop-wagon');
  //   if (!w || !this.isMode) return;

  //   const id = w.dataset.blockId;
  //   if (this.selected.has(id)) {
  //     this.selected.delete(id);
  //     w.classList.remove('is-export-selected'); // ИСПРАВЛЕНО: используем is-export-selected
  //   } else {
  //     this.selected.add(id);
  //     w.classList.add('is-export-selected'); // ИСПРАВЛЕНО: используем is-export-selected
  //   }
  //   console.log('ExportUI: Текущий выбранный список:', Array.from(this.selected));
  // }

  // _wireTrain(enable) {
  //   console.log('ExportUI: _wireTrain вызван. enable:', enable);
  //   if (enable) {
  //     if (!this._wagonHandler) {
  //       this._wagonHandler = this._handleWagonClick.bind(this);
  //       document.addEventListener('click', this._wagonHandler);
  //       console.log('ExportUI: Обработчик кликов по вагонам добавлен.');
  //     }
  //   } else {
  //     if (this._wagonHandler) {
  //       document.removeEventListener('click', this._wagonHandler);
  //       this._wagonHandler = null;
  //       console.log('ExportUI: Обработчик кликов по вагонам удален.');
  //     }
  //   }
  // }

  _orderByTextBlocks(ids) {
    // Сохраняем порядок следования, как в LyricsDisplay.textBlocks
    const blocks = this.blockLoopControl?.lyricsDisplay?.textBlocks || [];
    const order = new Map(blocks.map((b, i) => [String(b.id), i]));
    return ids
      .slice()
      .sort((a, b) => (order.get(String(a)) ?? 0) - (order.get(String(b)) ?? 0));
  }

  // В начале или в конце класса ExportUI, в зависимости от предпочтений стиля
  registerBlockLoopControl(blockLoopControl) {
    this.blockLoopControl = blockLoopControl;
    console.log('ExportUI: BlockLoopControl зарегистрирован.');
  }

  // 🎯 НОВОЕ: Метод для регистрации экземпляра AudioExporter
  registerExporter(exporter) {
    this.exporter = exporter;
    console.log('ExportUI: AudioExporter зарегистрирован.', exporter);
  }
}
