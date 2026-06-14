import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { getChallengesData } from "@/lib/seed-challenges";

// Admin-only seed endpoint — re-seeds challenges only (quick reset)
// For FULL database seed, use: npx prisma db seed
// Auth: Session-based (admin role check) OR ADMIN_SEED_KEY for CLI/curl access
export async function POST(request: Request) {
  try {
    // Check 1: Session-based admin auth (preferred for UI)
    const session = await getServerSession(authOptions);
    const isSessionAdmin = session?.user && session.user.role === "admin";

    // Check 2: Key-based auth (for CLI/curl access)
    const validKey = process.env.ADMIN_SEED_KEY;
    const adminKey = request.headers.get("X-Admin-Key");
    const urlKey = new URL(request.url).searchParams.get("key");
    let bodyKey: string | undefined;
    try {
      const body = await request.clone().json().catch(() => ({}));
      bodyKey = body?.adminKey;
    } catch {}
    const isKeyValid = validKey && (adminKey === validKey || bodyKey === validKey || urlKey === validKey);

    if (!isSessionAdmin && !isKeyValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🌱 Seeding challenges via API — v1.5.0 — 100 tricky challenges...");

    // Delete existing challenges and attempts
    await query(`DELETE FROM challenge_attempts`);
    await query(`DELETE FROM daily_challenge_assignments`);
    await query(`DELETE FROM challenges`);

    // Insert challenges one by one (safe for null values)
    const challenges = getChallengesData();
    
    let inserted = 0;
    for (const ch of challenges) {
      // Ensure order is a valid integer
      const orderVal = typeof ch.order === 'number' ? ch.order : inserted + 1;
      await query(
        `INSERT INTO challenges (id, title, description, difficulty, type, category, "xpReward", content, options, "correctAnswer", explanation, hints, "validationType", "validationConfig", "skillId", "order", "isActive", "createdAt", "updatedAt") 
         VALUES (substr(md5(random()::text), 1, 25), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, $14, true, NOW(), NOW())`,
        [ch.title, ch.description, ch.difficulty, ch.type, ch.category, ch.xpReward, ch.content, ch.options, ch.correctAnswer, ch.explanation, ch.hints ?? null, ch.validationType, ch.validationConfig ?? null, orderVal]
      );
      inserted++;
    }

    console.log(`✅ Seeded ${inserted} challenges`);
    return NextResponse.json({ success: true, count: inserted, version: "1.5.0" });
  } catch (error) {
    console.error("Seed error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
