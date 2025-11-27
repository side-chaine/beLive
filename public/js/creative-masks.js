/**
 * Креативные маски для системы эффектов
 * Расширенная коллекция масок с улучшенными алгоритмами
 */

class CreativeMasks {
    constructor() {
        this.creativeMaskList = [
            // Животные
            {
                id: 'cat-ears',
                name: '🐱 Кошачьи уши',
                category: 'animals',
                type: 'overlay',
                description: 'Милые кошачьи ушки и носик'
            },
            {
                id: 'dog-nose',
                name: '🐶 Собачий нос',
                category: 'animals',
                type: 'overlay',
                description: 'Забавный собачий носик и язычок'
            },
            {
                id: 'rabbit-ears',
                name: '🐰 Заячьи уши',
                category: 'animals',
                type: 'overlay',
                description: 'Длинные заячьи ушки'
            },
            
            // Фэнтези
            {
                id: 'dragon-horns',
                name: '🐉 Рога дракона',
                category: 'fantasy',
                type: 'overlay',
                description: 'Мощные рога дракона'
            },
            {
                id: 'fairy-wings',
                name: '🧚 Крылья феи',
                category: 'fantasy',
                type: 'overlay',
                description: 'Волшебные крылышки феи'
            },
            {
                id: 'wizard-hat',
                name: '🧙 Шляпа волшебника',
                category: 'fantasy',
                type: 'overlay',
                description: 'Остроконечная шляпа мага'
            },
            
            // Праздничные
            {
                id: 'party-hat',
                name: '🎉 Праздничный колпак',
                category: 'party',
                type: 'overlay',
                description: 'Яркий праздничный колпак'
            },
            {
                id: 'birthday-crown',
                name: '🎂 Корона именинника',
                category: 'party',
                type: 'overlay',
                description: 'Специальная корона на день рождения'
            },
            {
                id: 'new-year-hat',
                name: '🎄 Новогодняя шапка',
                category: 'party',
                type: 'overlay',
                description: 'Красная шапка Деда Мороза'
            },
            
            // Профессии
            {
                id: 'chef-hat',
                name: '👨‍🍳 Поварской колпак',
                category: 'profession',
                type: 'overlay',
                description: 'Белый поварской колпак'
            },
            {
                id: 'police-cap',
                name: '👮 Полицейская фуражка',
                category: 'profession',
                type: 'overlay',
                description: 'Фуражка полицейского'
            },
            {
                id: 'doctor-mask',
                name: '👨‍⚕️ Медицинская маска',
                category: 'profession',
                type: 'overlay',
                description: 'Защитная маска врача'
            },
            
            // Эмоции
            {
                id: 'heart-eyes',
                name: '😍 Сердечки в глазах',
                category: 'emotions',
                type: 'overlay',
                description: 'Влюбленные глазки с сердечками'
            },
            {
                id: 'star-eyes',
                name: '🤩 Звездные глаза',
                category: 'emotions',
                type: 'overlay',
                description: 'Глаза со звездочками'
            },
            {
                id: 'money-eyes',
                name: '🤑 Долларовые глаза',
                category: 'emotions',
                type: 'overlay',
                description: 'Глаза с символами доллара'
            }
        ];
    }

    /**
     * Получить все креативные маски
     */
    getAllCreativeMasks() {
        return this.creativeMaskList;
    }

    /**
     * Получить маски по категории
     */
    getMasksByCategory(category) {
        return this.creativeMaskList.filter(mask => mask.category === category);
    }

    /**
     * Получить маску по ID
     */
    getMaskById(id) {
        return this.creativeMaskList.find(mask => mask.id === id);
    }

    /**
     * Отрисовка кошачьих ушей
     */
    drawCatEars(ctx, landmarks, width, height) {
        const forehead = landmarks[10];
        const leftTemple = landmarks[103];
        const rightTemple = landmarks[332];

        if (!forehead || !leftTemple || !rightTemple) {return;}

        const centerX = (1 - forehead.x) * width;
        const centerY = forehead.y * height - 60;
        const earSize = Math.abs((1 - rightTemple.x) * width - (1 - leftTemple.x) * width) * 0.3;

        // Левое ухо
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.moveTo(centerX - earSize, centerY);
        ctx.lineTo(centerX - earSize/2, centerY - earSize);
        ctx.lineTo(centerX - earSize/4, centerY);
        ctx.closePath();
        ctx.fill();

        // Правое ухо
        ctx.beginPath();
        ctx.moveTo(centerX + earSize/4, centerY);
        ctx.lineTo(centerX + earSize/2, centerY - earSize);
        ctx.lineTo(centerX + earSize, centerY);
        ctx.closePath();
        ctx.fill();

        // Внутренние части ушей
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.moveTo(centerX - earSize*0.8, centerY - earSize*0.2);
        ctx.lineTo(centerX - earSize*0.6, centerY - earSize*0.7);
        ctx.lineTo(centerX - earSize*0.4, centerY - earSize*0.2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX + earSize*0.4, centerY - earSize*0.2);
        ctx.lineTo(centerX + earSize*0.6, centerY - earSize*0.7);
        ctx.lineTo(centerX + earSize*0.8, centerY - earSize*0.2);
        ctx.closePath();
        ctx.fill();

        // Кошачий носик
        const nose = landmarks[168];
        if (nose) {
            const noseX = (1 - nose.x) * width;
            const noseY = nose.y * height;
            
            ctx.fillStyle = '#FF69B4';
            ctx.beginPath();
            ctx.moveTo(noseX, noseY - 5);
            ctx.lineTo(noseX - 8, noseY + 5);
            ctx.lineTo(noseX + 8, noseY + 5);
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * Отрисовка собачьего носа
     */
    drawDogNose(ctx, landmarks, width, height) {
        const nose = landmarks[168];
        const upperLip = landmarks[13];

        if (!nose || !upperLip) {return;}

        const noseX = (1 - nose.x) * width;
        const noseY = nose.y * height;
        const lipX = (1 - upperLip.x) * width;
        const lipY = upperLip.y * height;

        // Собачий нос
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(noseX, noseY, 12, 8, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Блик на носу
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(noseX - 3, noseY - 2, 3, 2, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Язычок
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.ellipse(lipX, lipY + 15, 15, 25, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Контур языка
        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /**
     * Отрисовка заячьих ушей
     */
    drawRabbitEars(ctx, landmarks, width, height) {
        const forehead = landmarks[10];
        const leftTemple = landmarks[103];
        const rightTemple = landmarks[332];

        if (!forehead || !leftTemple || !rightTemple) {return;}

        const centerX = (1 - forehead.x) * width;
        const centerY = forehead.y * height - 40;
        const earLength = 80;
        const earWidth = 25;

        // Левое ухо
        ctx.fillStyle = '#F5DEB3';
        ctx.beginPath();
        ctx.ellipse(centerX - 30, centerY - earLength/2, earWidth, earLength, -0.3, 0, 2 * Math.PI);
        ctx.fill();

        // Правое ухо
        ctx.beginPath();
        ctx.ellipse(centerX + 30, centerY - earLength/2, earWidth, earLength, 0.3, 0, 2 * Math.PI);
        ctx.fill();

        // Внутренние части
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.ellipse(centerX - 30, centerY - earLength/2, earWidth*0.6, earLength*0.8, -0.3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(centerX + 30, centerY - earLength/2, earWidth*0.6, earLength*0.8, 0.3, 0, 2 * Math.PI);
        ctx.fill();

        // Контур
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(centerX - 30, centerY - earLength/2, earWidth, earLength, -0.3, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(centerX + 30, centerY - earLength/2, earWidth, earLength, 0.3, 0, 2 * Math.PI);
        ctx.stroke();
    }

    /**
     * Отрисовка рогов дракона
     */
    drawDragonHorns(ctx, landmarks, width, height) {
        const forehead = landmarks[10];
        const leftTemple = landmarks[103];
        const rightTemple = landmarks[332];

        if (!forehead || !leftTemple || !rightTemple) {return;}

        const centerX = (1 - forehead.x) * width;
        const centerY = forehead.y * height - 30;
        const hornHeight = 60;

        // Левый рог
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(centerX - 40, centerY);
        ctx.quadraticCurveTo(centerX - 50, centerY - hornHeight/2, centerX - 45, centerY - hornHeight);
        ctx.lineTo(centerX - 35, centerY - hornHeight + 10);
        ctx.quadraticCurveTo(centerX - 30, centerY - hornHeight/2, centerX - 25, centerY);
        ctx.closePath();
        ctx.fill();

        // Правый рог
        ctx.beginPath();
        ctx.moveTo(centerX + 25, centerY);
        ctx.quadraticCurveTo(centerX + 30, centerY - hornHeight/2, centerX + 35, centerY - hornHeight + 10);
        ctx.lineTo(centerX + 45, centerY - hornHeight);
        ctx.quadraticCurveTo(centerX + 50, centerY - hornHeight/2, centerX + 40, centerY);
        ctx.closePath();
        ctx.fill();

        // Текстура рогов
        ctx.strokeStyle = '#4B0000';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const y = centerY - hornHeight * 0.2 * (i + 1);
            // Левый рог
            ctx.beginPath();
            ctx.moveTo(centerX - 45, y);
            ctx.lineTo(centerX - 25, y);
            ctx.stroke();
            // Правый рог
            ctx.beginPath();
            ctx.moveTo(centerX + 25, y);
            ctx.lineTo(centerX + 45, y);
            ctx.stroke();
        }
    }

    /**
     * Отрисовка сердечек в глазах
     */
    drawHeartEyes(ctx, landmarks, width, height) {
        const leftEye = landmarks[33];
        const rightEye = landmarks[362];

        if (!leftEye || !rightEye) {return;}

        const leftEyeX = (1 - leftEye.x) * width;
        const leftEyeY = leftEye.y * height;
        const rightEyeX = (1 - rightEye.x) * width;
        const rightEyeY = rightEye.y * height;

        // Функция для рисования сердечка
        const drawHeart = (x, y, size) => {
            ctx.fillStyle = '#FF1493';
            ctx.beginPath();
            ctx.moveTo(x, y + size/4);
            ctx.bezierCurveTo(x - size/2, y - size/2, x - size, y + size/6, x, y + size);
            ctx.bezierCurveTo(x + size, y + size/6, x + size/2, y - size/2, x, y + size/4);
            ctx.closePath();
            ctx.fill();

            // Блик
            ctx.fillStyle = '#FF69B4';
            ctx.beginPath();
            ctx.arc(x - size/4, y, size/8, 0, 2 * Math.PI);
            ctx.fill();
        };

        // Рисуем сердечки в глазах
        drawHeart(leftEyeX, leftEyeY, 20);
        drawHeart(rightEyeX, rightEyeY, 20);
    }

    /**
     * Основная функция отрисовки креативной маски
     */
    drawCreativeMask(ctx, landmarks, mask, width, height) {
        try {
            ctx.save();

            switch (mask.id) {
                case 'cat-ears':
                    this.drawCatEars(ctx, landmarks, width, height);
                    break;
                case 'dog-nose':
                    this.drawDogNose(ctx, landmarks, width, height);
                    break;
                case 'rabbit-ears':
                    this.drawRabbitEars(ctx, landmarks, width, height);
                    break;
                case 'dragon-horns':
                    this.drawDragonHorns(ctx, landmarks, width, height);
                    break;
                case 'heart-eyes':
                    this.drawHeartEyes(ctx, landmarks, width, height);
                    break;
                default:
                    console.warn(`🎭 Неизвестная креативная маска: ${mask.id}`);
            }

            ctx.restore();
        } catch (error) {
            console.error(`❌ Ошибка отрисовки креативной маски ${mask.id}:`, error);
        }
    }
}

// Экспортируем класс для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreativeMasks;
} else {
    window.CreativeMasks = CreativeMasks;
} 