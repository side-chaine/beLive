/**
 * Image resize utility for Custom Backgrounds (Wave 1)
 * Canvas 2D, max 1920px, quality 0.85, alpha-aware output
 */

const MAX_DIM = 1920;
const JPEG_QUALITY = 0.85;

export async function resizeImage(
  file: File | Blob,
  maxDim: number = MAX_DIM,
  quality: number = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;
      const canvas = document.createElement('canvas');

      if (w <= maxDim && h <= maxDim) {
        canvas.width = w;
        canvas.height = h;
      } else {
        const scale = maxDim / Math.max(w, h);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        canvas.width = 0;
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Alpha detection — preserve PNG transparency
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasAlpha = imageData.data.some((val, i) => i % 4 === 3 && val < 255);

      const outputType = hasAlpha ? 'image/png' : 'image/jpeg';
      const outputQuality = hasAlpha ? undefined : quality;

      canvas.toBlob(
        (blob) => {
          canvas.width = 0;
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        outputType,
        outputQuality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}
