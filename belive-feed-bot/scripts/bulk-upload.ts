/**
 * Bulk upload — TC-TG-02 Phase 2.1
 * 
 * Загружает ZIP-файлы из папки в Telegram, получает file_id,
 * сохраняет в KV (или выводит JSON для ручного импорта).
 * 
 * Использование:
 *   npx tsx scripts/bulk-upload.ts [путь_к_папке]
 *   npx tsx scripts/bulk-upload.ts ~/Desktop/tracks/
 * 
 * Переменные окружения:
 *   BOT_TOKEN — токен Telegram бота
 *   CHAT_ID — ID чата куда слать файлы (админ)
 *   KV_MODE — "auto" (попробовать wrangler), "json" (только JSON)
 * 
 * >50MB файлы — SKIP (выводятся в отчёт для ffmpeg)
 */

const BOT_TOKEN = process.env.BOT_TOKEN || '8506268729:AAF_4gkscFhHUTGdEJUeFNVKoWSaYsNgHiA';
const CHAT_ID = process.env.CHAT_ID || '435558710';
const KV_MODE = (process.env.KV_MODE || 'json') as 'auto' | 'json';
const TG_API = 'https://api.telegram.org/bot';
const MAX_FILE_SIZE = 52_428_800; // 50 MB
const RATE_LIMIT_MS = 2000; // 2s между файлами

interface TrackData {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  slug: string;
  fileName: string;
  type: 'duo' | 'full';
  fileIds: Record<string, string>;
  fileSize: number;
}

interface UploadResult {
  slug: string;
  title: string;
  fileId: string;
  fileSize: number;
  ok: boolean;
  error?: string;
}

// ── Парсер имени файла ──
function parseFilename(filename: string): { artist: string; title: string } {
  const cleaned = filename.replace(/\.(zip|flac|mp3)$/i, '');
  // Отсекаем номер трека: "01 - Papercut" → "Papercut"
  const withoutNumber = cleaned.replace(/^\d{1,3}\s*[–-]\s*/, '');
  // Парсим "Artist - Title"
  const match = withoutNumber.match(/^(.+?)\s*[–-]\s*(.+)$/);
  if (!match) return { artist: 'Linkin Park', title: withoutNumber };
  return { artist: match[1].trim(), title: match[2].trim() };
}

// ── Извлечение альбома из пути ──
function extractAlbumFromPath(filePath: string): { album: string; year: number } {
  const parts = filePath.split('/');
  for (const part of parts) {
    const match = part.match(/^(\d{4})\s*[–-]\s*(.+)$/);
    if (match) return { album: match[2].trim(), year: parseInt(match[1]) };
  }
  return { album: 'Unknown', year: 0 };
}

// ── Slug из названия ──
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

// guessAlbum удалён — используется extractAlbumFromPath из пути файла

// ── Отправить файл в Telegram ──
async function sendToTelegram(filePath: string, fileName: string): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  const fs = await import('fs');
  const fileBuffer = fs.readFileSync(filePath);
  
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/zip' });
  formData.append('document', blob, fileName);
  formData.append('chat_id', CHAT_ID);

  const res = await fetch(`${TG_API}${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(no body)');
    return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
  }

  const data: any = await res.json();
  const fileId = data?.result?.document?.file_id;
  if (!fileId) return { ok: false, error: 'No file_id in response' };

  return { ok: true, fileId };
}

// ── Сохранить в KV через wrangler (если работает) ──
async function saveToKV(catalog: TrackData[]): Promise<void> {
  if (KV_MODE === 'json') {
    console.log('\n📋 JSON для ручного импорта в KV:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify({ key: 'track_data:catalog', value: JSON.stringify(catalog) }));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Или вставь в CF Dashboard → KV → EPHEMERAL_KV → track_data:catalog');
    return;
  }

  // KV_MODE === 'auto' — пробуем wrangler
  const { execSync } = await import('child_process');
  
  for (const track of catalog) {
    const cmd = `npx wrangler kv:key put --binding=EPHEMERAL_KV "track_data:${track.slug}" '${JSON.stringify(track)}'`;
    try {
      execSync(cmd, { cwd: process.cwd(), timeout: 30000 });
      process.stdout.write('.');
    } catch (e: any) {
      console.error(`\n❌ wrangler failed for ${track.slug}: ${e.message}`);
      console.log('→ Пробуй KV_MODE=json');
      break;
    }
  }

  // Сохраняем каталог целиком
  const catalogCmd = `npx wrangler kv:key put --binding=EPHEMERAL_KV "track_data:catalog" '${JSON.stringify(catalog)}'`;
  try {
    execSync(catalogCmd, { cwd: process.cwd(), timeout: 30000 });
    console.log('\n✅ catalog saved to KV');
  } catch (e: any) {
    console.error(`\n❌ catalog wrangler failed: ${e.message}`);
    console.log('→ Используй JSON выше для ручного импорта');
  }
}

// ── Главная функция ──
async function main() {
  const args = process.argv.slice(2);
  const trackDir = args[0];

  if (!trackDir) {
    console.error('❌ Укажи путь к папке с ZIP:');
    console.error('   npx tsx scripts/bulk-upload.ts ~/Desktop/Linkin\\ Park/');
    process.exit(1);
  }

  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(trackDir)) {
    console.error(`❌ Папка не найдена: ${trackDir}`);
    process.exit(1);
  }

  // Собираем все ZIP файлы
  const zipFiles: string[] = [];
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.zip') && !entry.name.endsWith('.flac.zip')) {
        zipFiles.push(fullPath);
      }
    }
  }
  walkDir(trackDir);

  // Убираем дубликаты (если трек есть и в альбоме, и в корне)
  const seenSlugs = new Set<string>();
  const uniqueFiles: string[] = [];

  // Приоритет: файлы в подпапках > файлы в корне
  const sortedFiles = zipFiles.sort((a, b) => {
    const aDepth = a.split('/').length;
    const bDepth = b.split('/').length;
    return bDepth - aDepth; // deeper first (in album folders)
  });

  for (const file of sortedFiles) {
    const name = path.basename(file);
    const { title } = parseFilename(name);
    const slug = toSlug(title);
    if (!seenSlugs.has(slug) && !name.includes('[bonus track]')) {
      seenSlugs.add(slug);
      uniqueFiles.push(file);
    }
  }

  console.log(`📁 Найдено ZIP: ${zipFiles.length}`);
  console.log(`📁 Уникальных: ${uniqueFiles.length}`);
  console.log(`📁 Пропущено (дубликаты): ${zipFiles.length - uniqueFiles.length}`);
  console.log('');

  const uploaded: TrackData[] = [];
  const skipped: Array<{ file: string; sizeMB: number; reason: string }> = [];
  const errors: Array<{ file: string; error: string }> = [];
  let counter = 0;

  for (const file of uniqueFiles) {
    counter++;
    const stats = fs.statSync(file);
    const sizeMB = stats.size / (1024 * 1024);
    const name = path.basename(file);
    const { artist, title } = parseFilename(name);
    const slug = toSlug(title);

    console.log(`[${counter}/${uniqueFiles.length}] ${title} (${sizeMB.toFixed(1)} MB)...`);

    // Проверка размера
    if (stats.size > MAX_FILE_SIZE) {
      skipped.push({ file: name, sizeMB, reason: `>50MB (${sizeMB.toFixed(1)} MB)` });
      console.log(`   ⏭️  SKIP: >50MB (${sizeMB.toFixed(1)} MB)`);
      continue;
    }

    if (!title) {
      skipped.push({ file: name, sizeMB, reason: 'Cannot parse filename' });
      console.log(`   ⏭️  SKIP: cannot parse filename`);
      continue;
    }

    // Отправляем в Telegram
    const result = await sendToTelegram(file, name);

    if (!result.ok) {
      errors.push({ file: name, error: result.error || 'Unknown' });
      console.log(`   ❌ ERROR: ${result.error}`);
      continue;
    }

    // Определяем альбом из пути файла
    const { album, year } = extractAlbumFromPath(file);

    // Сохраняем в структуру
    const track: TrackData = {
      id: `lp-${String(uploaded.length + 1).padStart(2, '0')}`,
      title,
      artist: artist || 'Linkin Park',
      album,
      year,
      slug,
      fileName: name,
      type: 'duo',
      fileIds: {
        instrumental: result.fileId!,
        vocals: '',
      },
      fileSize: stats.size,
    };

    uploaded.push(track);
    console.log(`   ✅ ${title} → file_id: ${result.fileId!.slice(0, 20)}...`);

    // Пауза между запросами
    if (counter < uniqueFiles.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  // ── Итоговый отчёт ──
  console.log('\n' + '═'.repeat(50));
  console.log('📊 ИТОГ');
  console.log('═'.repeat(50));
  console.log(`✅ Загружено:    ${uploaded.length}`);
  console.log(`⏭️  Пропущено:    ${skipped.length}`);
  console.log(`❌ Ошибок:       ${errors.length}`);

  if (uploaded.length > 0) {
    console.log('\n📦 Загруженные треки:');
    uploaded.forEach(t => {
      console.log(`   ${t.id} | ${t.title} | ${t.slug} | ‹ ${t.type.toUpperCase()} › | ${(t.fileSize / 1024 / 1024).toFixed(1)} MB`);
    });

    // Сохраняем в KV
    await saveToKV(uploaded);
  }

  if (skipped.length > 0) {
    console.log('\n⏭️  Пропущенные (>50MB) — нужен ffmpeg:');
    skipped.forEach(s => {
      console.log(`   ${s.file} — ${s.reason}`);
    });
    console.log('\n📜 Скрипт сжатия: scripts/compress-tracks.sh');
  }

  if (errors.length > 0) {
    console.log('\n❌ Ошибки:');
    errors.forEach(e => console.log(`   ${e.file} — ${e.error}`));
  }

  // ── Вывод file_id для прямого импорта ──
  if (uploaded.length > 0) {
    console.log('\n📋 file_id для KV (по одному):');
    uploaded.forEach(t => {
      console.log(`track_data:${t.slug}`);
      console.log(JSON.stringify(t));
      console.log('');
    });
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
