import { NextRequest, NextResponse } from "next/server";
import { MediaService } from "@/lib/media-service";
import { storageProvider, S3StorageProvider } from "@/lib/storage";

/**
 * Get an accessible URL for a media file.
 * For S3 (private bucket): generates a signed URL.
 * For other storage: returns the URL as-is.
 */
async function getAccessibleMediaUrl(rawUrl: string | null, fileKey: string | null): Promise<string | null> {
  if (!rawUrl) return null;

  if (storageProvider instanceof S3StorageProvider) {
    try {
      const s3 = storageProvider as S3StorageProvider;
      const key = fileKey || s3.extractKeyFromUrl(rawUrl);
      if (key) {
        const resolved = await s3.resolveKey(key);
        const actualKey = resolved?.key || key;
        return await s3.getSignedUrl(actualKey, 3600);
      }
    } catch (err) {
      console.warn(`[Media API] Signed URL failed for ${rawUrl.substring(0, 80)}:`, err);
      return `/api/knowledge/files/proxy?url=${encodeURIComponent(rawUrl)}`;
    }
  }

  return rawUrl;
}

/**
 * GET /api/knowledge/media?articleId=xxx
 * Получить список медиафайлов для статьи/урока
 * URLs automatically converted to signed URLs for S3 private buckets.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("articleId");

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId обязательный параметр" },
        { status: 400 }
      );
    }

    const media = await MediaService.getByArticle(articleId);

    // Convert raw S3 URLs to signed URLs for accessibility
    const mediaWithAccessibleUrls = await Promise.all(
      media.map(async (item) => ({
        ...item,
        url: await getAccessibleMediaUrl(item.url, item.fileKey),
        thumbnailUrl: item.thumbnailUrl
          ? await getAccessibleMediaUrl(item.thumbnailUrl, null)
          : null,
      }))
    );

    return NextResponse.json(mediaWithAccessibleUrls);
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки медиафайлов" },
      { status: 500 }
    );
  }
}
