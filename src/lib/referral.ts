import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";

/**
 * Minimal interface for executing SQL queries.
 * Compatible with both neon Pool and PoolClient (for transactions).
 */
interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}

/**
 * Process referral rewards for a new user.
 * Awards +50 XP to both referrer and referee, logs XP, increments referral count.
 *
 * @param newUserId  - The user who was referred
 * @param referredById - The user who referred them
 * @param client - Optional PoolClient for use within a transaction
 */
export async function processReferralReward(
  newUserId: string,
  referredById: string,
  client?: Queryable,
): Promise<void> {
  const q = client || pool;
  try {
    // Increment referrer's referral count and award XP to both
    await q.query(
      `UPDATE users SET "referralCount" = COALESCE("referralCount", 0) + 1, xp = xp + 50 WHERE id = $1`,
      [referredById],
    );
    await q.query(
      `UPDATE users SET xp = xp + 50 WHERE id = $1`,
      [newUserId],
    );
    // Log XP for referrer
    await q.query(
      `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, 50, 'Реферальный бонус', $3)`,
      [genId("xpl_"), referredById, newUserId],
    );
    // Log XP for referee
    await q.query(
      `INSERT INTO xp_logs (id, "userId", amount, reason, "referenceId") VALUES ($1, $2, 50, 'Реферальный бонус (приглашённый)', $3)`,
      [genId("xpl_"), newUserId, referredById],
    );
    console.log("[Referral] Rewards applied for user:", newUserId, "referred by:", referredById);
  } catch (err) {
    console.error("[Referral] Reward error (non-critical):", err);
  }
}

/**
 * Look up a referral code from the cookie store and return the referrer's user ID.
 */
export async function getReferrerIdFromCookie(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref")?.value;
    if (refCode) {
      const result = await pool.query(
        `SELECT id FROM users WHERE "referralCode" = $1`,
        [refCode],
      ) as { rows: { id: string }[] };
      if (result.rows[0]) {
        return result.rows[0].id;
      }
    }
  } catch {
    // Cookie access may fail in some contexts
  }
  return null;
}

/**
 * Generate and assign a unique referral code for a user.
 * Uses email prefix + random suffix, with collision retry.
 *
 * This is the SINGLE source of truth — previously duplicated in:
 * - src/app/api/referral/route.ts
 * - src/app/api/user/stats/route.ts
 *
 * @param userId - The user ID to generate a code for
 * @param email - The user's email (used as prefix)
 * @returns The generated referral code, or null on failure
 */
export async function ensureReferralCode(userId: string, email: string): Promise<string | null> {
  const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const referralCode = `${emailPrefix}-${randomSuffix}`;

  try {
    await pool.query(
      `UPDATE users SET "referralCode" = $1 WHERE id = $2 AND "referralCode" IS NULL`,
      [referralCode, userId]
    );
    return referralCode;
  } catch {
    // Collision — try once more with a different suffix
    const altSuffix = Math.random().toString(36).substring(2, 6);
    const altCode = `${emailPrefix}-${altSuffix}`;
    try {
      await pool.query(
        `UPDATE users SET "referralCode" = $1 WHERE id = $2 AND "referralCode" IS NULL`,
        [altCode, userId]
      );
      return altCode;
    } catch {
      // Silently fail — referral code generation can be retried later
      return null;
    }
  }
}
