/**
 * Клиентские утилиты для работы с медиафайлами.
 * НЕ импортирует серверные модули (db, storage) — безопасен для "use client".
 */

// ── Типы файлов ──────────────────────────────────────────────

export const ALLOWED_FILE_TYPES: Record<
  string,
  { mimeTypes: string[]; maxSize: number; fileType: string }
> = {
  video: {
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maxSize: 2 * 1024 * 1024 * 1024, // 2 GB
    fileType: "video",
  },
  pdf: {
    mimeTypes: ["application/pdf"],
    maxSize: 100 * 1024 * 1024, // 100 MB
    fileType: "document",
  },
  pptx: {
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSize: 200 * 1024 * 1024, // 200 MB
    fileType: "document",
  },
  docx: {
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSize: 100 * 1024 * 1024, // 100 MB
    fileType: "document",
  },
  image: {
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    maxSize: 20 * 1024 * 1024, // 20 MB
    fileType: "image",
  },
};

/**
 * Определить fileType по MIME-типу
 */
export function detectFileType(
  mimeType: string
): { fileType: string; category: string } | null {
  for (const [category, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (config.mimeTypes.includes(mimeType)) {
      return { fileType: config.fileType, category };
    }
  }
  return null;
}

/**
 * Валидация файла перед загрузкой
 */
export function validateFile(
  file: { type: string; size: number; name: string }
): { valid: boolean; error?: string; fileType?: string; category?: string } {
  const detected = detectFileType(file.type);

  if (!detected) {
    const allowed = Object.values(ALLOWED_FILE_TYPES)
      .flatMap((c) => c.mimeTypes)
      .join(", ");
    return {
      valid: false,
      error: `Неподдерживаемый тип файла: ${file.type}. Допустимые: ${allowed}`,
    };
  }

  const config = ALLOWED_FILE_TYPES[detected.category];
  if (file.size > config.maxSize) {
    const maxMB = Math.round(config.maxSize / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Файл слишком большой: ${fileMB} МБ. Максимум для ${detected.category}: ${maxMB} МБ`,
    };
  }

  return {
    valid: true,
    fileType: detected.fileType,
    category: detected.category,
  };
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Иконка по типу файла
 */
export function getFileIcon(fileType: string, mimeType: string): string {
  if (fileType === "video") return "🎬";
  if (mimeType === "application/pdf") return "📄";
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("pptx")
  )
    return "📊";
  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("docx")
  )
    return "📝";
  if (fileType === "image") return "🖼️";
  return "📎";
}

/**
 * Генерация пути в хранилище
 * Формат: knowledge/{entityType}/{entityId}/{timestamp}_{filename}
 */
export function generateStorageKey(
  entityType: "article" | "lesson" | "space",
  entityId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._-]/g, "_");
  return `knowledge/${entityType}s/${entityId}/${timestamp}_${sanitized}`;
}
