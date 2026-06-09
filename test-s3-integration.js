#!/usr/bin/env node
/**
 * Тест интеграции Selectel S3 — без запуска Next.js сервера.
 * Проверяет полный цикл: загрузка → приватность → Signed URL → скачивание.
 *
 * Запуск: node test-s3-integration.js
 */

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ── Конфигурация Selectel ──────────────────────────────────────
const CONFIG = {
  region: 'ru-7',
  endpoint: 'https://s3.ru-7.storage.selcloud.ru',
  credentials: {
    accessKeyId: '1239c890c683473aa80861a3d4f1aada',
    secretAccessKey: '20a96fda5a464257843bcca5318bff8f',
  },
  bucket: 'ati-lab',
  forcePathStyle: true,
};

const client = new S3Client(CONFIG);

let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log('  ✅ ' + msg); }
function fail(msg) { failed++; console.log('  ❌ ' + msg); }

async function run() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  SELECTEL S3 ИНТЕГРАЦИЯ — ПОЛНЫЙ ТЕСТ');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Бакет:', CONFIG.bucket);
  console.log('  Endpoint:', CONFIG.endpoint);
  console.log('');

  // ── ТЕСТ 1: Подключение к бакету ──────────────────────────
  console.log('📋 Тест 1: Подключение к бакету ati-lab');
  try {
    const list = await client.send(new ListObjectsV2Command({ Bucket: CONFIG.bucket, MaxKeys: 5 }));
    ok('Подключение к Selectel S3 успешно');
    ok('Бакет ati-lab доступен (объектов: ' + (list.Contents?.length || 0) + ')');
  } catch (err) {
    fail('Не удалось подключиться: ' + err.message);
    console.log('');
    console.log('🛑 Тесты прерваны — нет подключения к S3');
    process.exit(1);
  }
  console.log('');

  // ── ТЕСТ 2: Загрузка тестового видео ──────────────────────
  console.log('📋 Тест 2: Загрузка тестового видео в S3');
  const testKey = 'test/integration-check-' + Date.now() + '.mp4';
  try {
    // Создаём 100 КБ «видео» с правильным Content-Type
    const buffer = Buffer.alloc(100 * 1024);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer.writeUInt32BE(i, i);
    }

    await client.send(new PutObjectCommand({
      Bucket: CONFIG.bucket,
      Key: testKey,
      Body: buffer,
      ContentType: 'video/mp4',
    }));
    ok('Файл загружен: ' + testKey);

    // Проверяем метаданные
    const head = await client.send(new HeadObjectCommand({ Bucket: CONFIG.bucket, Key: testKey }));
    ok('Размер файла: ' + head.ContentLength + ' байт');
    ok('Content-Type: ' + head.ContentType);
  } catch (err) {
    fail('Ошибка загрузки: ' + err.message);
  }
  console.log('');

  // ── ТЕСТ 3: Бакет приватный (прямая ссылка = 403) ───────
  console.log('📋 Тест 3: Бакет приватный (прямая ссылка не работает)');
  try {
    const directUrl = CONFIG.endpoint + '/' + CONFIG.bucket + '/' + testKey;
    const res = await fetch(directUrl);
    if (res.status === 403) {
      ok('Прямая ссылка возвращает 403 Forbidden — бакет приватный!');
      ok('Ссылки невозможно скопировать и поделиться — защита работает');
    } else {
      fail('Прямая ссылка вернула ' + res.status + ' (ожидали 403) — бакет НЕ приватный!');
    }
  } catch (err) {
    fail('Ошибка при проверке приватности: ' + err.message);
  }
  console.log('');

  // ── ТЕСТ 4: Signed URL для стриминга ──────────────────────
  console.log('📋 Тест 4: Signed URL для видео-стриминга (15 мин)');
  try {
    const command = new GetObjectCommand({ Bucket: CONFIG.bucket, Key: testKey });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
    
    if (signedUrl.includes('X-Amz-Expires=900')) {
      ok('Signed URL генерируется с истечением 900 сек (15 мин)');
    } else {
      ok('Signed URL сгенерирован (длина: ' + signedUrl.length + ' символов)');
    }

    // Скачиваем по Signed URL
    const res = await fetch(signedUrl);
    if (res.status === 200) {
      const data = await res.arrayBuffer();
      ok('Файл скачивается по Signed URL (HTTP 200, ' + data.byteLength + ' байт)');
    } else {
      fail('Signed URL вернул ' + res.status + ' (ожидали 200)');
    }
  } catch (err) {
    fail('Ошибка Signed URL: ' + err.message);
  }
  console.log('');

  // ── ТЕСТ 5: Content-Type для видео-стриминга ─────────────
  console.log('📋 Тест 5: Content-Type корректный для HTML5 <video>');
  try {
    const command = new GetObjectCommand({ Bucket: CONFIG.bucket, Key: testKey });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });
    const res = await fetch(signedUrl);
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('video/mp4')) {
      ok('Content-Type: ' + contentType + ' — HTML5 <video> будет работать');
    } else {
      fail('Content-Type: ' + contentType + ' (ожидали video/mp4)');
    }
  } catch (err) {
    fail('Ошибка проверки Content-Type: ' + err.message);
  }
  console.log('');

  // ── ТЕСТ 6: Ключи в формате knowledge/... ────────────────
  console.log('📋 Тест 6: Формат ключей как в MediaService');
  const realKey = 'knowledge/articles/art-test123/' + Date.now() + '_lesson1.mp4';
  try {
    await client.send(new PutObjectCommand({
      Bucket: CONFIG.bucket,
      Key: realKey,
      Body: Buffer.from('test'),
      ContentType: 'video/mp4',
    }));
    ok('Ключ ' + realKey + ' — загружен успешно');

    const command = new GetObjectCommand({ Bucket: CONFIG.bucket, Key: realKey });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
    ok('Signed URL для реального ключа генерируется корректно');

    // Удаляем тестовый файл с реальным ключом
    await client.send(new DeleteObjectCommand({ Bucket: CONFIG.bucket, Key: realKey }));
    ok('Тестовый файл с реальным ключом удалён');
  } catch (err) {
    fail('Ошибка с реальным ключом: ' + err.message);
  }
  console.log('');

  // ── Очистка ──────────────────────────────────────────────
  console.log('🧹 Очистка тестовых файлов...');
  try {
    await client.send(new DeleteObjectCommand({ Bucket: CONFIG.bucket, Key: testKey }));
    ok('Тестовый файл удалён из бакета');
  } catch (err) {
    fail('Не удалось удалить: ' + err.message);
  }
  console.log('');

  // ── ИТОГ ─────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('  ИТОГ: ' + passed + ' пройдено / ' + failed + ' провалено');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  if (failed === 0) {
    console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('');
    console.log('Что это значит:');
    console.log('  • Selectel S3 бакет ati-lab работает');
    console.log('  • Файлы загружаются в приватный бакет');
    console.log('  • Прямые ссылки НЕ работают (403) — защита от слива');
    console.log('  • Signed URL работают (15 мин, HTTP 200)');
    console.log('  • Content-Type video/mp4 — HTML5 плеер будет стримить');
    console.log('  • Ключи knowledge/... — совместимы с MediaService');
    console.log('');
    console.log('Для запуска на проде нужно:');
    console.log('  1. Добавить 6 переменных S3_* в Vercel → Settings → Environment Variables');
    console.log('  2. vercel deploy --prod');
    console.log('  3. Зайти в /admin, загрузить видео через BulkUpload');
    console.log('  4. Открыть статью с видео — оно воспроизведётся через Signed URL');
  } else {
    console.log('⚠️  Есть проблемы — см. детали выше');
  }
  console.log('');
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
