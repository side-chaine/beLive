const fs = require('fs');

// Простой оранжевый квадрат как base64 PNG
const icon192Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAAP0lEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfgbLYAABVjneMAAAAABJRU5ErkJggg==';

const icons = {
  '192': icon192Base64,
  '512': icon192Base64, // Для 512x512 пока используем ту же 192x192 base64, это нормально для теста
};

// Убедимся, что директория public/icons существует
const dir = 'public/icons';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

Object.entries(icons).forEach(([size, base64Data]) => {
  const path = `${dir}/icon-${size}x${size}.png`;
  // Декодируем base64 строку в буфер и записываем в файл
  fs.writeFile(path, Buffer.from(base64Data, 'base64'), (err) => {
    if (err) {
      console.error(`❌ Ошибка при создании иконки ${path}:`, err);
    } else {
      console.log(`✅ Создана иконка: ${path}`);
    }
  });
});
