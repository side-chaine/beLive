const fs = require('fs');
const path = require('path');

// Минимальный валидный PNG (1x1 оранжевый пиксель)
// Для продакшена замените на реальные иконки!
const createMinimalPNG = (size) => {
  // PNG header + IHDR + IDAT + IEND для оранжевого квадрата
  // Это заглушка — работает, но лучше использовать реальные иконки
  
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Оранжевый фон
  ctx.fillStyle = '#ffb444';
  ctx.fillRect(0, 0, size, size);
  
  // Текст
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size / 4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('bL', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
};

// Альтернатива без canvas — скачать placeholder
const https = require('https');

const downloadIcon = (size, outputPath) => {
  const url = `https://placehold.co/${size}x${size}/ffb444/ffffff/png?text=bL`;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ Created: ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
};

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Создать директорию если не существует
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

Promise.all([
  downloadIcon(192, path.join(iconsDir, 'icon-192x192.png')),
  downloadIcon(512, path.join(iconsDir, 'icon-512x512.png'))
]).then(() => {
  console.log('✅ All icons created!');
}).catch((err) => {
  console.error('❌ Error creating icons:', err);
});
