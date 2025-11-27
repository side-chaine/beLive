// js/block_editor.js

// Функция для добавления кнопки удаления к блоку
function addDeleteButtonToBlock(blockElement) {
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-block-btn');
    deleteBtn.innerHTML = '&#x1F5D1;'; // Иконка корзины (Unicode)
    deleteBtn.title = 'Удалить блок';
    deleteBtn.style.display = 'none'; // По умолчанию скрыта

    blockElement.style.position = 'relative';

    blockElement.addEventListener('mouseenter', () => {
        deleteBtn.style.display = 'inline-block';
    });
    blockElement.addEventListener('mouseleave', () => {
        deleteBtn.style.display = 'none';
    });
    blockElement.addEventListener('focusin', () => {
        deleteBtn.style.display = 'inline-block';
    });
    blockElement.addEventListener('focusout', (e) => {
        if (!blockElement.contains(e.relatedTarget) || e.relatedTarget === deleteBtn) {
            if (e.relatedTarget !== deleteBtn) {
                 setTimeout(() => {
                    if (document.activeElement !== deleteBtn && document.activeElement !== blockElement && !blockElement.contains(document.activeElement)) {
                        deleteBtn.style.display = 'none';
                    }
                }, 100);
            }
        }
    });
    deleteBtn.addEventListener('focus', () => {
        deleteBtn.style.display = 'inline-block';
    });
    deleteBtn.addEventListener('blur', () => {
        if (document.activeElement !== blockElement && !blockElement.contains(document.activeElement)) {
            deleteBtn.style.display = 'none';
        }
    });

    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const blockListArea = blockElement.parentNode;
        if (blockListArea.children.length > 1) {
            blockElement.remove();
            console.log('Текстовый блок удален.');
        } else {
            alert('Нельзя удалить единственный текстовый блок.');
        }
    });
    blockElement.appendChild(deleteBtn);
}

// НОВАЯ вспомогательная функция для создания и настройки блока
function createAndSetupBlock(container, text = '', placeholder = 'Введите текст блока...', blockType = 'verse') {
    const newBlock = document.createElement('div');
    newBlock.classList.add('text-block');
    newBlock.setAttribute('contenteditable', 'true');
    newBlock.innerText = text; // Сохраняем текст как есть (пустые строки станут пустыми блоками)
    newBlock.setAttribute('data-placeholder', placeholder);
    newBlock.setAttribute('data-block-type', blockType); // Добавляем тип блока как атрибут
    
    // Добавляем класс в зависимости от типа блока для стилизации
    newBlock.classList.add(`block-type-${blockType}`);

    addDeleteButtonToBlock(newBlock); // Добавляем кнопку удаления

    // Добавляем стандартные обработчики событий (можно расширить при необходимости)
    newBlock.addEventListener('focus', () => {
        // console.log('Block focused:', newBlock);
    });
    newBlock.addEventListener('blur', () => {
        // console.log('Block blurred:', newBlock);
    });
    newBlock.addEventListener('input', () => {
        // console.log('Input event on block:', newBlock.textContent);
    });

    container.appendChild(newBlock);
    return newBlock;
}

// Функция для интеллектуального разделения текста на блоки
function splitTextIntoBlocks(text) {
    if (!text || text.trim() === '') {return [];}
    
    // Нормализуем все переносы строк к \n
    const normalizedText = text.replace(/\r\n|\r/g, '\n');
    console.log('ЗАПУСК РЕШАЮЩЕГО ТЕСТА: Поиск исключительно пустых строк-разделителей.');
    
    // Выводим для отладки закодированное представление каждого символа
    const charArray = Array.from(normalizedText);
    console.log('===== АНАЛИЗ ПЕРВЫХ 30 СИМВОЛОВ ТЕКСТА (КОДЫ ASCII) =====');
    const sampleChars = charArray.slice(0, 30);
    sampleChars.forEach((char, i) => {
        console.log(`Символ ${i + 1}: "${char.replace(/\n/g, '\\n')}" | код: ${char.charCodeAt(0)}`);
    });
    
    // Логируем также позиции всех переносов строк
    const newLinePositions = [];
    charArray.forEach((char, i) => {
        if (char === '\n') {
            newLinePositions.push(i);
        }
    });
    console.log('Позиции всех символов переноса строки (\n) в тексте (индексы):', newLinePositions.join(', '));
    
    // ОСНОВНОЙ И ЕДИНСТВЕННЫЙ МЕТОД РАЗДЕЛЕНИЯ:
    // Ищем последовательность: ПЕРЕНОС + (возможно пробелы/табы) + ПЕРЕНОС
    // Это и есть наша "пустая строка-разделитель"
    console.log('Попытка разделения текста с помощью регулярного выражения: /\n\s*\n/');
    const potentialBlocks = normalizedText.split(/\n\s*\n/);
    console.log(`Результат split(): Найдено ${potentialBlocks.length} потенциальных блоков (до фильтрации).`);
    potentialBlocks.forEach((block, index) => {
        console.log(`  Потенциальный блок ${index}: "${block.substring(0,50).replace(/\n/g, '\\n')}..."`);
    });

    const actualBlocks = potentialBlocks.map(block => block.trim()).filter(block => block.trim() !== '');
    console.log(`РЕЗУЛЬТАТ ТЕСТА: Найдено ${actualBlocks.length} фактических блоков (после trim и filter).`);

    if (actualBlocks.length <= 1) {
        console.warn('ВНИМАНИЕ: Текст разделен на 1 блок или менее. Это КРАЙНЕ ВЕРОЯТНО означает, что исходный текст (pendingText из localStorage) НЕ СОДЕРЖИТ пустых строк-разделителей (двойных переносов строк). Проверьте код, который сохраняет текст в localStorage перед передачей в редактор блоков.');
    }
    
    const blockObjects = actualBlocks.map(content => ({
        content: content,
        type: 'verse' // Тип по умолчанию, потом определим точнее
    }));
    
    // Определение типов блоков - это вторично, но оставим для консистентности
    if (blockObjects.length > 0) {
        determineBlockTypes(blockObjects);
    }
    
    return blockObjects;
}

// Вспомогательная функция для разделения текста на равные блоки (НЕ ИСПОЛЬЗУЕТСЯ В ЭТОМ ТЕСТЕ)
/* function divideTextIntoEqualBlocks(lines) { ... } */

// Функция для определения типов блоков
function determineBlockTypes(blocks) {
    // Маркеры для разных типов блоков
    const chorusMarkers = [
        /красиво ты/i,
        /это сердце/i,
        /припев/i,
        /chorus/i
    ];
    
    const bridgeMarkers = [
        /бридж/i,
        /bridge/i,
        /кончилась любовь/i
    ];
    
    // Для каждого блока определяем его тип
    for (let i = 0; i < blocks.length; i++) {
        const blockContent = blocks[i].content.toLowerCase();
        
        // Проверяем на припев
        if (chorusMarkers.some(marker => marker.test(blockContent))) {
            blocks[i].type = 'chorus';
            continue;
        }
        
        // Проверяем на бридж
        if (bridgeMarkers.some(marker => marker.test(blockContent))) {
            blocks[i].type = 'bridge';
            continue;
        }
        
        // Проверяем на повторяющиеся блоки (припевы часто повторяются)
        for (let j = 0; j < i; j++) {
            if (j !== i) {
                const similarity = calculateBlockSimilarity(blocks[i].content, blocks[j].content);
                if (similarity > 0.7) { // Если блоки похожи на 70% и более
                    blocks[i].type = blocks[j].type || 'chorus';
                    break;
                }
            }
        }
    }
    
    // Логируем результаты определения типов для отладки
    console.log('Определены типы блоков:', blocks.map(b => b.type).join(', '));
}

// Новая функция для вычисления сходства между блоками
function calculateBlockSimilarity(block1, block2) {
    if (!block1 || !block2) {return 0;}
    
    const lines1 = block1.split('\n').map(line => line.trim().toLowerCase());
    const lines2 = block2.split('\n').map(line => line.trim().toLowerCase());
    
    // Проверка на абсолютное совпадение
    if (block1.toLowerCase() === block2.toLowerCase()) {return 1.0;}
    
    // Если блоки очень разного размера, они вряд ли похожи
    const lengthRatio = Math.min(lines1.length, lines2.length) / Math.max(lines1.length, lines2.length);
    if (lengthRatio < 0.5) {return 0.0;}
    
    // Считаем количество совпадающих строк
    let matchingLines = 0;
    for (const line1 of lines1) {
        if (line1.length < 3) {continue;} // Пропускаем слишком короткие строки
        
        for (const line2 of lines2) {
            if (line1 === line2 || 
                (line1.length > 5 && line2.includes(line1)) || 
                (line2.length > 5 && line1.includes(line2))) {
                matchingLines++;
                break;
            }
        }
    }
    
    // Вычисляем коэффициент сходства
    return matchingLines / Math.max(lines1.length, lines2.length);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Block Editor JS Loaded');

    const blockListArea = document.querySelector('.block-list-area');
    const addBlockBtn = document.getElementById('add-block-btn');
    const saveTrackBtn = document.getElementById('save-track-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    const pendingText = localStorage.getItem('pendingBlockEditText');
    const shouldRedirectFlag = localStorage.getItem('redirectToBlockEditor');

    // Добавление стилей для блоков разных типов
    const style = document.createElement('style');
    style.textContent = `
        .text-block.block-type-verse {
            background-color: #f8f8f8;
            border-left: 3px solid #607d8b;
        }
        
        .text-block.block-type-chorus {
            background-color: #e3f2fd;
            border-left: 3px solid #1976d2;
            font-weight: bold;
        }
        
        .text-block.block-type-bridge {
            background-color: #e8f5e9;
            border-left: 3px solid #4caf50;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);

    if (blockListArea) {
        blockListArea.innerHTML = ''; // Всегда начинаем с чистого контейнера блоков

        if (pendingText && shouldRedirectFlag === 'true') {
            // DEBUG: Выводим содержимое pendingText перед разделением
            console.log('pendingText перед split:', JSON.stringify(pendingText));

            // Нормализуем все переносы строк к \n перед разделением
            const normalizedText = pendingText.replace(/\r\n|\r/g, '\n');
            console.log('normalizedText для обработки:', JSON.stringify(normalizedText));

            // Используем новую интеллектуальную функцию разделения на блоки
            const blocks = splitTextIntoBlocks(normalizedText);

            if (blocks.length > 0) {
                blocks.forEach((block, index) => {
                    createAndSetupBlock(
                        blockListArea, 
                        block.content, 
                        `Текстовый блок ${index + 1} (${block.type})`, 
                        block.type
                    );
                });
                console.log(`Текст из localStorage загружен и разделен на ${blocks.length} блоков (улучшенная логика).`);
            } else {
                // Если разделение не сработало, создаем один блок с полным текстом
                createAndSetupBlock(blockListArea, normalizedText, 'Блок с полным текстом', 'verse');
                console.log('Разделение не сработало. Создан один блок с полным текстом.');
            }
            
            // Очищаем localStorage после использования
            localStorage.removeItem('pendingBlockEditText');
            localStorage.removeItem('redirectToBlockEditor');
            console.log('Данные для начальной загрузки текста из localStorage очищены.');
        } else {
            // Если нет pendingText или флага, создаем один пустой блок по умолчанию
            createAndSetupBlock(blockListArea, '', 'Введите текст здесь...', 'verse');
            console.log('Нет pending text, создан один пустой блок по умолчанию.');
        }
    } else {
        console.warn('Не найден элемент .block-list-area. Редактор блоков не сможет корректно инициализироваться.');
    }

    // Логика добавления нового блока кнопкой
    if (addBlockBtn && blockListArea) {
        addBlockBtn.addEventListener('click', () => {
            const newBlock = createAndSetupBlock(blockListArea, '', 'Введите текст нового блока...', 'verse');
            newBlock.focus(); // Автоматически фокусируемся на новом блоке
            console.log('Новый текстовый блок добавлен.');
        });
    } else {
        if (!addBlockBtn && blockListArea) {console.warn('Кнопка "Добавить блок" не найдена.');}
        // Если blockListArea нет, предупреждение уже было выше.
    }

    // Логика сохранения трека
    if (saveTrackBtn) {
        saveTrackBtn.addEventListener('click', () => {
            const blocks = document.querySelectorAll('.block-list-area .text-block');
            const blockTexts = [];
            blocks.forEach(block => {
                // Сохраняем innerText, чтобы сохранить переносы строк как есть
                blockTexts.push(block.innerText);
            });

            // Объединяем текст из блоков. Используем два переноса строки как разделитель.
            const combinedText = blockTexts.join('\n\n');

            const trackInfoString = localStorage.getItem('trackInfoForBlockEditor');
            
            // Проверка на полностью пустой текст перед сохранением
            if (combinedText.trim() === '' && blocks.length === 1 && blocks[0].innerText.trim() === '') {
                 if (!confirm("Текст не введен. Сохранить трек без текста?")) {
                    return; // Не сохраняем, если пользователь отменил
                }
            }

            if (trackInfoString) {
                localStorage.setItem('editedBlockTextResult', combinedText);
                localStorage.setItem('finalizeTrackUpload', 'true'); // Флаг для track-catalog.js
                
                console.log('Отредактированный текст и флаг для финализации сохранены в localStorage.');
                window.location.href = 'index.html'; // Перенаправляем на главную страницу
            } else {
                console.error('Не найдена информация о треке в localStorage. Сохранение невозможно.');
                alert('Произошла ошибка: не найдена информация о треке. Попробуйте загрузить трек заново.');
            }
        });
    } else {
        console.warn('Кнопка "Сохранить трек" не найдена.');
    }

    // Логика отмены редактирования
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите отменить редактирование? Все несохраненные изменения будут потеряны.')) {
                // Очищаем ключи, связанные с процессом редактирования
                localStorage.removeItem('pendingBlockEditText');
                localStorage.removeItem('redirectToBlockEditor');
                localStorage.removeItem('trackInfoForBlockEditor');
                localStorage.removeItem('editedBlockTextResult');
                localStorage.removeItem('finalizeTrackUpload');
                // currentTempAudioId не должен здесь удаляться, он обрабатывается в track-catalog.js
                console.log('Редактирование отменено, localStorage (связанный с редактором) очищен.');
                window.location.href = 'index.html'; // Возвращаемся на главную страницу
            }
        });
    } else {
        console.warn('Кнопка "Отмена" не найдена.');
    }
}); 