/**
 * fix-catalog.ts — удаление дубликатов из track_data:catalog
 *
 * Вариант A: Вставляет JSON напрямую в KV через wrangler
 *   npx tsx scripts/fix-catalog.ts --apply
 *
 * Вариант B: Выводит чистый JSON для ручного импорта (рекомендуется)
 *   npx tsx scripts/fix-catalog.ts
 */

// Текущий catalog из KV (скопировать из CF Dashboard → KV → track_data:catalog)
// Пока не можем прочитать через API — вводим вручную
const CURRENT_CATALOG: any[] = []; // ← ЗАПОЛНИТЬ из Dashboard

// ── Если не читается через API — вставь JSON сюда вручную ──
// 1. Открой CF Dashboard → KV → EPHEMERAL_KV → track_data:catalog
// 2. Скопируй JSON
// 3. Вставь ниже вместо пустого массива

const catalog: any[] = CURRENT_CATALOG.length > 0 ? CURRENT_CATALOG : [
  // Временные данные на случай пустого ввода — выведем промт
];

function main() {
  if (catalog.length === 0) {
    console.log('⚠️  catalog пуст. Скопируй JSON из CF Dashboard → KV → EPHEMERAL_KV → track_data:catalog');
    console.log('   и вставь в переменную CURRENT_CATALOG в этом скрипте.');
    console.log('   Или используй ручной способ (см. ниже).');
    console.log('');
    showManualFix();
    process.exit(1);
  }

  const before = catalog.length;
  const seen = new Set<string>();
  const cleaned: any[] = [];

  for (const track of catalog) {
    if (!seen.has(track.slug)) {
      seen.add(track.slug);
      cleaned.push(track);
    }
  }

  const after = cleaned.length;
  const removed = before - after;

  console.log(`📊 Было: ${before} треков`);
  console.log(`📊 Стало: ${after} треков`);
  console.log(`🗑️  Удалено дубликатов: ${removed}`);
  console.log('');

  if (removed > 0) {
    // Показать какие дубликаты удалены
    const slugs = new Set(cleaned.map(t => t.slug));
    const duplicates = catalog.filter(t => !slugs.has(t.slug));
    console.log('❌ Удалены:');
    duplicates.forEach(t => console.log(`   ${t.id} | ${t.title}`));
    console.log('');

    // Обновить ID
    const reindexed = cleaned.map((t, i) => ({
      ...t,
      id: `lp-${String(i + 1).padStart(2, '0')}`
    }));

    // JSON для KV
    console.log('📋 JSON для track_data:catalog (скопировать и вставить в KV):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(reindexed, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Индивидуальные ключи для каждого трека
    console.log('');
    console.log('📋 Индивидуальные ключи (для каждого трека):');
    for (const track of reindexed) {
      console.log(`\ntrack_data:${track.slug}`);
      console.log(JSON.stringify(track));
    }
  }
}

function showManualFix() {
  console.log('── РУЧНОЙ ФИКС ──');
  console.log('1. Открой CF Dashboard → Workers & Pages → belive-feed-bot → KV');
  console.log('2. Найди ключ track_data:catalog → View → Copy JSON');
  console.log('3. Вставь JSON в CURRENT_CATALOG в этом скрипте');
  console.log('4. Запусти: npx tsx scripts/fix-catalog.ts');
  console.log('');
  console.log('ИЛИ сделай вручную:');
  console.log('1. Открой track_data:catalog в KV Editor');
  console.log('2. Найди дубликат Cure for the Itch (lp-14)');
  console.log('3. Удали его из JSON массива');
  console.log('4. Сохрани');
  console.log('5. Найди ключ track_data:cure-for-the-itch');
  console.log('6. Убедись что в нём id = "lp-02" (первый)');
}

main();
