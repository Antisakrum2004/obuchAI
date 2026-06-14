import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureSchema } from "@/lib/db-migrate";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    // Ensure schema is up-to-date (banned, hearts, etc.)
    await ensureSchema();

    // Use raw SQL to avoid Prisma schema sync issues with ALTER TABLE columns
    const usersResult = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.xp,
        u.level,
        u.streak,
        u."maxStreak",
        u.hearts,
        u.banned,
        u.image,
        u."createdAt",
        u."lastActiveAt",
        u."lastIp",
        u."lastUserAgent",
        u."lastDevice",
        (SELECT COUNT(*) FROM challenge_attempts ca WHERE ca."userId" = u.id) AS attempt_count
      FROM users u
      ORDER BY u."createdAt" DESC
    `);

    const users = usersResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      xp: Number(row.xp) || 0,
      level: Number(row.level) || 1,
      streak: Number(row.streak) || 0,
      maxStreak: Number(row.maxStreak) || 0,
      hearts: Number(row.hearts) || 3,
      banned: row.banned === true || row.banned === true,
      image: row.image,
      createdAt: row.createdAt,
      lastActiveAt: row.lastActiveAt,
      lastIp: row.lastIp,
      lastUserAgent: row.lastUserAgent,
      lastDevice: row.lastDevice,
      _count: { attempts: Number(row.attempt_count) || 0 },
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Ошибка сервера", details: String(error) }, { status: 500 });
  }
}
