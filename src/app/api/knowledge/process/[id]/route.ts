import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

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
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

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

    const allowedFields = ["status", "progress", "result", "error"];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (key === "status" && typeof value === "string") {
        fields.push(`status = $${idx++}`);
        values.push(value);

        // Auto-set timestamps based on status
        if (value === "processing") {
          fields.push(`"startedAt" = NOW()`);
        } else if (value === "done" || value === "error") {
          fields.push(`"completedAt" = NOW()`);
        }
      } else if (key === "progress" && typeof value === "number") {
        fields.push(`progress = $${idx++}`);
        values.push(Math.max(0, Math.min(100, value)));
      } else if (key === "result" && typeof value === "object") {
        fields.push(`result = $${idx++}`);
        values.push(JSON.stringify(value));
      } else if (key === "error" && typeof value === "string") {
        fields.push(`error = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "Нет полей для обновления" },
        { status: 400 }
      );
    }

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE processing_queue SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
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
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
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
