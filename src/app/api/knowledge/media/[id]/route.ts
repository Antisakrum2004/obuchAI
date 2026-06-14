import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { MediaService } from "@/lib/media-service";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/knowledge/media/[id]
 * Получить информацию о медиафайле
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const media = await MediaService.getById(id);

    if (!media) {
      return NextResponse.json(
        { error: "Медиафайл не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json(media);
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки медиафайла" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge/media/[id]
 * Удалить медиафайл (только admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userRole = session.user?.role;
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Недостаточно прав для удаления файлов" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const deleted = await MediaService.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Медиафайл не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: "Ошибка удаления медиафайла" },
      { status: 500 }
    );
  }
}
