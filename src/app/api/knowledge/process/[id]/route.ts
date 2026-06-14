import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { processUpdateSchema, buildSetClause, PROCESS_JSON_FIELDS } from "@/lib/validation";

// GET /api/knowledge/process/[id] — Get status of a processing queue item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT pq.id, pq.type, pq.status, pq."articleId", pq."inputData", pq.result, pq.error, pq.progress,
              pq."startedAt", pq."completedAt", pq."createdAt", pq."updatedAt",
              a.title as "articleTitle"
       FROM processing_queue pq
       LEFT JOIN articles a ON pq."articleId" = a.id
       WHERE pq.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Задача обработки не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Error fetching processing queue item:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки задачи обработки" },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge/process/[id] — Update processing queue item (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const rawBody = await request.json();

    // Validate with Zod schema — rejects unknown keys and bad types
    const parseResult = processUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Ошибка валидации", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify the queue item exists
    const existing = await pool.query(
      `SELECT id, status FROM processing_queue WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Задача обработки не найдена" },
        { status: 404 }
      );
    }

    // Build SET clause from validated data
    const { setClauses, values, nextParamIdx } = buildSetClause(data, PROCESS_JSON_FIELDS);

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "Нет полей для обновления" },
        { status: 400 }
      );
    }

    // Auto-set timestamps based on status
    if (data.status === "processing") {
      setClauses.push(`"startedAt" = NOW()`);
    } else if (data.status === "done" || data.status === "error") {
      setClauses.push(`"completedAt" = NOW()`);
    }

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE processing_queue SET ${setClauses.join(", ")} WHERE id = $${nextParamIdx} RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating processing queue item:", error);
    return NextResponse.json(
      { error: "Ошибка обновления задачи обработки" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/process/[id] — Cancel a processing queue item (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Check if the item exists and is cancellable
    const existing = await pool.query(
      `SELECT id, status FROM processing_queue WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Задача обработки не найдена" },
        { status: 404 }
      );
    }

    const status = existing.rows[0].status;
    if (status === "done") {
      return NextResponse.json(
        { error: "Невозможно отменить завершённую задачу" },
        { status: 400 }
      );
    }

    // Mark as cancelled (set status to 'error' with cancellation note)
    const result = await pool.query(
      `UPDATE processing_queue SET status = 'error', error = 'Отменено администратором', "completedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Задача обработки отменена",
      entry: result.rows[0],
    });
  } catch (error) {
    console.error("Error cancelling processing queue item:", error);
    return NextResponse.json(
      { error: "Ошибка отмены задачи обработки" },
      { status: 500 }
    );
  }
}
