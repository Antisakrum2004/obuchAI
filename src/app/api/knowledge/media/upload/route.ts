import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MediaService } from "@/lib/media-service";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/knowledge/media/upload
 * Загрузить медиафайл (только admin)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userRole = (session.user as Record<string, unknown>)?.role;
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Недостаточно прав для загрузки файлов" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = (formData.get("entityType") as string) || "article";
    const entityId = formData.get("entityId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не предоставлен" },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId обязательный параметр" },
        { status: 400 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const result = await MediaService.uploadAndCreate({
      file,
      entityType: entityType as "article" | "lesson" | "space",
      entityId,
      uploadedBy: userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error uploading media:", error);
    const message =
      error instanceof Error ? error.message : "Ошибка загрузки файла";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
