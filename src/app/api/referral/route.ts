import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";

function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// GET: Return current user's referral info
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const result = await query(
      `SELECT "referralCode", "referralCount", "referredBy" FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = result.rows[0];

    // Auto-generate referral code if missing
    if (!user.referralCode) {
      const emailResult = await query(
        `SELECT email FROM users WHERE id = $1`,
        [userId]
      );
      const email = emailResult.rows[0]?.email || "user";
      const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const referralCode = `${emailPrefix}-${randomSuffix}`;

      try {
        await query(
          `UPDATE users SET "referralCode" = $1 WHERE id = $2 AND "referralCode" IS NULL`,
          [referralCode, userId]
        );
        user.referralCode = referralCode;
      } catch {
        const altSuffix = Math.random().toString(36).substring(2, 6);
        const altCode = `${emailPrefix}-${altSuffix}`;
        try {
          await query(
            `UPDATE users SET "referralCode" = $1 WHERE id = $2 AND "referralCode" IS NULL`,
            [altCode, userId]
          );
          user.referralCode = altCode;
        } catch {
          // Silently fail
        }
      }
    }

    return NextResponse.json({
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referredBy: user.referredBy || null,
      xpFromReferrals: (user.referralCount || 0) * 50,
    });
  } catch (error) {
    console.error("Referral GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST: Apply a referral code for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Укажите реферальный код" }, { status: 400 });
    }

    // Check if user already has a referrer
    const userResult = await query(
      `SELECT "referredBy", "referralCode" FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (userResult.rows[0].referredBy) {
      return NextResponse.json({ error: "Вы уже использовали реферальный код" }, { status: 400 });
    }

    // Find the referrer by code
    const referrerResult = await query(
      `SELECT id FROM users WHERE "referralCode" = $1`,
      [code.trim().toLowerCase()]
    );

    if (referrerResult.rows.length === 0) {
      return NextResponse.json({ error: "Реферальный код не найден" }, { status: 404 });
    }

    const referrerId = referrerResult.rows[0].id;

    // Can't refer yourself
    if (referrerId === userId) {
      return NextResponse.json({ error: "Нельзя использовать свой собственный код" }, { status: 400 });
    }

    // Use a transaction for atomicity
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Set referredBy on the user
      await client.query(
        `UPDATE users SET "referredBy" = $1 WHERE id = $2`,
        [referrerId, userId]
      );

      // Increment referrer's referral count and award XP to both
      await client.query(
        `UPDATE users SET "referralCount" = COALESCE("referralCount", 0) + 1, xp = xp + 50 WHERE id = $1`,
        [referrerId]
      );

      await client.query(
        `UPDATE users SET xp = xp + 50 WHERE id = $1`,
        [userId]
      );

      // Log XP for referrer
      await client.query(
        `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, 50, 'Реферальный бонус', $3)`,
        [genId(), referrerId, userId]
      );

      // Log XP for referee
      await client.query(
        `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, 50, 'Реферальный бонус (приглашённый)', $3)`,
        [genId(), userId, referrerId]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Реферальный код применён! Оба пользователя получают +50 XP",
        xpAwarded: 50,
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Referral POST error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
