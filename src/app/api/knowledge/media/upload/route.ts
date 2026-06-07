import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MediaService, validateFile } from "@/lib/media-service";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/knowledge/media/upload
 * Загрузка файла (multipart/form-data)
 *
 * Body (FormData):
 *   - file: File (обязательно)
 *   - entityType: "article" | "lesson" | "space" (обязательно)
 *   - entityId: string (обязательно)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Проверка admin-прав (только админы могут загружать файлы)
    const userRole = (session.user as Record<string, unknown>)?.role;
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Недостаточно прав для загрузки файлов" },
        { status: 403 }
      );
    }

    // Парсинг multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не предоставлен" },
        { status: 400 }
      );
    }

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType и entityId обязательны" },
        { status: 400 }
      );
    }

    if (!["article", "lesson", "space"].includes(entityType)) {
      return NextResponse.json(
        { error: "entityType должен быть article, lesson или space" },
        { status: 400 }
      );
    }

    // Валидация файла
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Загрузка через MediaService
    const userId = (session.user as Record<string, unknown>)?.id as string;
    const result = await MediaService.uploadAndCreate({
      file,
      entityType: entityType as "article" | "lesson" | "space",
      entityId,
      uploadedBy: userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    const message =
      error instanceof Error ? error.message : "Ошибка загрузки файла";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
