import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";

// POST /api/knowledge/process — Trigger AI processing for an article (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { articleId, types } = body as { articleId?: string; types?: string[] };

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId обязателен" },
        { status: 400 }
      );
    }

    if (!types || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json(
        { error: "types обязателен и должен быть непустым массивом" },
        { status: 400 }
      );
    }

    const validTypes = ["metadata", "glossary", "graph", "course"];
    const invalidTypes = types.filter((t: string) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Недопустимые типы обработки: ${invalidTypes.join(", ")}. Допустимые: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify article exists
    const articleCheck = await pool.query(
      `SELECT id, title FROM articles WHERE id = $1`,
      [articleId]
    );
    if (articleCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Статья не найдена" },
        { status: 404 }
      );
    }

    // Map processing type to queue type
    const typeToQueueType: Record<string, string> = {
      metadata: "ai_metadata",
      glossary: "glossary_extract",
      graph: "graph_build",
      course: "course_draft",
    };

    const createdEntries: Record<string, unknown>[] = [];

    for (const type of types) {
      const queueType = typeToQueueType[type];
      const inputData = JSON.stringify({ articleId, type });

      // Check if there's already a pending/processing entry for this article+type
      const existingEntry = await pool.query(
        `SELECT id FROM processing_queue WHERE "articleId" = $1 AND type = $2 AND status IN ('pending', 'processing')`,
        [articleId, queueType]
      );

      if (existingEntry.rows.length > 0) {
        // Skip — already queued or processing
        createdEntries.push({
          id: existingEntry.rows[0].id,
          type: queueType,
          status: "already_queued",
          articleId,
        });
        continue;
      }

      const queueId = genId("pq_");
      const result = await pool.query(
        `INSERT INTO processing_queue (id, type, status, "articleId", "inputData", progress, "createdAt", "updatedAt")
         VALUES ($1, $2, 'pending', $3, $4, 0, NOW(), NOW())
         RETURNING *`,
        [queueId, queueType, articleId, inputData]
      );

      createdEntries.push(result.rows[0]);
    }

    return NextResponse.json(
      {
        message: `Создано ${createdEntries.length} задач обработки`,
        entries: createdEntries,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating processing tasks:", error);
    return NextResponse.json(
      { error: "Ошибка создания задач обработки" },
      { status: 500 }
    );
  }
}
