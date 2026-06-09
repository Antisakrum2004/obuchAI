/**
 * Жёсткий парсер S3-ключа из строки любого формата.
 *
 * В БД поля url / fileKey могут приходить в разных форматах:
 *   - s3://ati-lab/knowledge/articles/CLAUDE CODE full
 *   - s3://ati-lab/knowledge/articles/CLAUDE%20CODE%20full
 *   - https://s3.ru-7.storage.selcloud.ru/ati-lab/knowledge/articles/CLAUDE CODE full
 *   - https://s3.ru-7.storage.selcloud.ru/ati-lab/knowledge/articles/CLAUDE%20CODE%20full
 *   - knowledge/articles/CLAUDE CODE full          (уже чистый ключ)
 *   - knowledge/articles/CLAUDE%20CODE%20full       (URL-кодированный ключ)
 *
 * На выходе ВСЕГДА чистый S3-ключ с реальными символами
 * (пробелы — это пробелы, а не %20).
 *
 * Это нужно потому что:
 * 1. S3 хранит ключи с реальными символами (пробел = пробел, не %20)
 * 2. getSignedUrl() сам делает encodeURIComponent по каждому сегменту
 * 3. Если подать %20 в getSignedUrl, получится двойное кодирование (%2520)
 */

/**
 * Извлечь чистый S3-ключ из строки любого формата.
 *
 * @param raw  Строка из БД (поле url или fileKey)
 * @returns    Чистый S3-ключ (например "knowledge/articles/CLAUDE CODE full")
 *             или null если строку невозможно распарсить
 */
export function extractS3Key(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // Убираем концевые пробелы
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let key: string;

  // ── 1. Формат s3://bucket/key ──
  // Отрезаем протокол и имя бакета целиком
  if (trimmed.startsWith("s3://")) {
    const afterProtocol = trimmed.slice(5); // "ati-lab/knowledge/articles/CLAUDE CODE full"
    const slashIndex = afterProtocol.indexOf("/");
    if (slashIndex <= 0) {
      // Нет слеша после бакета — некорректный s3:// URI
      console.warn(`[extractS3Key] Invalid s3:// URI (no key after bucket): "${trimmed}"`);
      return null;
    }
    key = afterProtocol.slice(slashIndex + 1);
  }
  // ── 2. Формат https://endpoint/bucket/key ──
  // Отрезаем домен и имя бакета через URL-парсер
  else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      // pathname = "/ati-lab/knowledge/articles/CLAUDE%20CODE%20full"
      // или "/ati-lab/knowledge/articles/CLAUDE CODE full" (URL конструктор кодирует в %20)
      const segments = parsed.pathname
        .split("/")
        .filter(Boolean); // ["ati-lab", "knowledge", "articles", "CLAUDE%20CODE%20full"]

      if (segments.length < 2) {
        // Только бакет — нет ключа
        console.warn(`[extractS3Key] HTTPS URL has no key path: "${trimmed}"`);
        return null;
      }

      // Первая часть pathname — имя бакета, остальное — ключ
      key = segments.slice(1).join("/");
    } catch {
      console.warn(`[extractS3Key] Failed to parse HTTPS URL: "${trimmed}"`);
      return null;
    }
  }
  // ── 3. Уже чистый ключ (без протокола) ──
  // Например "knowledge/articles/CLAUDE CODE full"
  else {
    key = trimmed;
  }

  // ── 4. URL-декодирование: превращаем %20 → пробел, %D0%90 → А и т.д. ──
  // S3 хранит ключи с реальными символами. Если в БД ключ пришёл URL-кодированным,
  // его нужно раскодировать, иначе getSignedUrl() сделает двойное кодирование.
  try {
    key = decodeURIComponent(key);
  } catch {
    // Невалидная percent-кодировка — используем как есть
  }

  // ── 5. Финальная очистка ──
  // Убираем ведущие/концевые слеши и пробелы
  key = key.replace(/^\/+/, "").replace(/\/+$/, "").trim();

  if (!key) return null;

  return key;
}
