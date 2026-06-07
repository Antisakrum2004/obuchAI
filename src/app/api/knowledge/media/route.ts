import { NextRequest, NextResponse } from "next/server";
import { MediaService } from "@/lib/media-service";

/**
 * GET /api/knowledge/media?articleId=xxx
 * Получить список медиафайлов для статьи/урока
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
    return NextResponse.json(media);
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки медиафайлов" },
      { status: 500 }
    );
  }
}
