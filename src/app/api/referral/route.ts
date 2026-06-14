import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, pool } from "@/lib/db";
import { processReferralReward, ensureReferralCode } from "@/lib/referral";

// GET: Return current user's referral info
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;

    const result = await query(
      `SELECT "referralCode", "referralCount", "referredBy", email FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = result.rows[0];

    // Auto-generate referral code if missing (using shared function)
    if (!user.referralCode) {
      const code = await ensureReferralCode(userId, user.email || "user");
      if (code) {
        user.referralCode = code;
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

    const userId = session.user.id;
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

      // Award referral XP to both users and log it
      await processReferralReward(userId, referrerId, client);

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
