import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/knowledge/recover-videos — DEPRECATED in Sprint 7
// S3 video storage has been abandoned in favor of external cloud links (YouTube, Yandex.Disk).
// This route is kept as a stub for backward compatibility. It will be fully removed in a future release.
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "S3 video recovery is deprecated",
      message: "Начиная с Sprint 7, видео хранятся через внешние облачные ссылки (YouTube, Яндекс.Диск). Восстановление из S3 больше не поддерживается.",
    },
    { status: 410 }
  );
}
