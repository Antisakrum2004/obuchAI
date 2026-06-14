import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureReferralCode } from "@/lib/referral";

// Parse a User-Agent string into a short human-readable device description
function parseUserAgent(ua: string): string {
  // Detect browser
  let browser = "Unknown";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";

  // Detect OS
  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  // Detect device type
  let device = "";
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) device = "📱 ";
  else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) device = "📟 ";
  else device = "💻 ";

  return `${device}${browser} / ${os}`;
}

// Extract IP from request headers (Vercel provides x-forwarded-for)
function extractIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;

    // Capture tracking info from this request
    const ip = extractIp(request);
    const userAgent = request.headers.get("user-agent") || null;
    const device = userAgent ? parseUserAgent(userAgent) : null;

    // Update user tracking info + lastActiveAt
    await query(
      `UPDATE users SET "lastActiveAt" = NOW(), "lastIp" = $1, "lastUserAgent" = $2, "lastDevice" = $3 WHERE id = $4`,
      [ip, userAgent, device, userId]
    );

    const userResult = await query(
      `SELECT id, name, email, image, role, xp, level, streak, "maxStreak", "lastActiveAt", "referralCode", "referralCount", "referredBy", "consecutiveCorrect", "consecutiveWrong"
       FROM users WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Auto-generate referral code if missing (using shared function)
    if (!user.referralCode) {
      const code = await ensureReferralCode(userId, user.email || "user");
      if (code) {
        user.referralCode = code;
      }
    }

    // Calculate rank
    const rankResult = await query(
      `SELECT COUNT(*) + 1 AS rank FROM users WHERE xp > $1`,
      [user.xp],
    );
    const rank = Number(rankResult.rows[0].rank);

    // Completed challenges count
    const completedResult = await query(
      `SELECT COUNT(*) AS count FROM challenge_attempts WHERE "userId" = $1 AND "isCorrect" = true`,
      [userId],
    );
    const completedChallenges = Number(completedResult.rows[0].count);

    // Determine adaptive difficulty boost
    const consecutiveCorrect = Number(user.consecutiveCorrect || 0);
    const consecutiveWrong = Number(user.consecutiveWrong || 0);
    let difficultyBoost: string | null = null;
    if (consecutiveCorrect >= 5) {
      difficultyBoost = "harder";
    } else if (consecutiveWrong >= 3) {
      difficultyBoost = "easier";
    }

    return NextResponse.json({
      ...user,
      rank,
      completedChallenges,
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referredBy: user.referredBy || null,
      difficultyBoost,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
