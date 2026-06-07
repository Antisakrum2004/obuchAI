import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, icon, category, order, parentId, requiredXp } = body;

    if (!name || !slug || !description || !category) {
      return NextResponse.json(
        { error: "Обязательные поля: name, slug, description, category" },
        { status: 400 }
      );
    }

    const id = genId();
    const result = await pool.query(
      `INSERT INTO skills (id, name, slug, description, icon, category, "order", "parentId", "requiredXp", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [id, name, slug, description, icon || null, category, order || 0, parentId || null, requiredXp || 100]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Admin skill create error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера", detail: String(error) },
      { status: 500 }
    );
  }
}
