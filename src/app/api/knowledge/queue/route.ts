import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

// GET /api/knowledge/queue — List all processing queue items (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const articleId = searchParams.get("articleId");

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`pq.status = $${idx++}`);
      params.push(status);
    }

    if (type) {
      conditions.push(`pq.type = $${idx++}`);
      params.push(type);
    }

    if (articleId) {
      conditions.push(`pq."articleId" = $${idx++}`);
      params.push(articleId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT pq.id, pq.type, pq.status, pq."articleId", pq."inputData", pq.result, pq.error, pq.progress,
              pq."startedAt", pq."completedAt", pq."createdAt", pq."updatedAt",
              a.title as "articleTitle"
       FROM processing_queue pq
       LEFT JOIN articles a ON pq."articleId" = a.id
       ${whereClause}
       ORDER BY pq."createdAt" DESC`,
      params
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching processing queue:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки очереди обработки" },
      { status: 500 }
    );
  }
}
