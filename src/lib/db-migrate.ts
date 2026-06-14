/**
 * Database migration utilities — single source of truth for schema changes.
 *
 * All ALTER TABLE statements that were previously scattered across 7+ route files
 * are consolidated here. This ensures:
 * 1. No duplication (same column added in 3 different files)
 * 2. Consistent ordering of migrations
 * 3. Easy to audit and maintain
 *
 * Usage: Call `ensureSchema()` from the admin migrate endpoint or on app startup.
 * Each statement uses IF NOT EXISTS / IF EXISTS guards for idempotency.
 */
import { pool } from "@/lib/db";

let migrationLock = false;
let migrationDone = false;

/**
 * Run all pending schema migrations. Safe to call multiple times — each
 * statement is guarded with IF NOT EXISTS / IF EXISTS.
 *
 * This replaces the scattered ALTER TABLE calls in:
 * - src/lib/media-service.ts
 * - src/app/api/admin/users/route.ts
 * - src/app/api/knowledge/glossary/route.ts
 * - src/app/api/knowledge/migrate/route.ts
 * - src/app/api/knowledge/seed/route.ts
 * - src/app/api/knowledge/quiz/submit/route.ts
 */
export async function ensureSchema(): Promise<{ applied: number; skipped: boolean }> {
  // Prevent concurrent migrations
  if (migrationDone) return { applied: 0, skipped: true };
  if (migrationLock) {
    // Wait for the other migration to finish
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { applied: 0, skipped: true };
  }

  migrationLock = true;
  let applied = 0;

  try {
    // ─── Phase 1: User table columns ────────────────────────────────────────
    const userColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "hearts" INTEGER NOT NULL DEFAULT 3`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "nextHeartAt" TIMESTAMP(3)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastIp" TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastUserAgent" TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastDevice" TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "consecutiveWrong" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy" TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0`,
    ];
    for (const sql of userColumns) {
      try { await pool.query(sql); applied++; } catch { /* column may already exist */ }
    }

    // ─── Phase 2: Challenge attempts columns ────────────────────────────────
    const attemptColumns = [
      `ALTER TABLE challenge_attempts ADD COLUMN IF NOT EXISTS "timeSpent" INTEGER`,
    ];
    for (const sql of attemptColumns) {
      try { await pool.query(sql); applied++; } catch {}
    }

    // ─── Phase 3: Media columns ─────────────────────────────────────────────
    const mediaColumns = [
      `ALTER TABLE media ADD COLUMN IF NOT EXISTS "fileKey" TEXT`,
    ];
    for (const sql of mediaColumns) {
      try { await pool.query(sql); applied++; } catch {}
    }

    // ─── Phase 4: Glossary columns ──────────────────────────────────────────
    const glossaryColumns = [
      `ALTER TABLE glossary_terms ADD COLUMN IF NOT EXISTS "aliases" TEXT`,
      `ALTER TABLE glossary_terms ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false`,
    ];
    for (const sql of glossaryColumns) {
      try { await pool.query(sql); applied++; } catch {}
    }

    // ─── Phase 5: Article columns (Sprint 6 — AI Content Pipeline) ──────────
    const articleColumns = [
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "spaceId" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "pptxUrl" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "sourceType" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS difficulty TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "estimatedTime" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3)`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "errorMessage" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "keyConcepts" TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS prerequisites TEXT`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "nextTopics" TEXT`,
    ];
    for (const sql of articleColumns) {
      try { await pool.query(sql); applied++; } catch {}
    }

    // ─── Phase 6: Article columns (Sprint 7 — Interactive lessons) ──────────
    const articleSprint7 = [
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS quiz JSONB`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS practical_task JSONB`,
      `ALTER TABLE articles ADD COLUMN IF NOT EXISTS timecodes JSONB`,
    ];
    for (const sql of articleSprint7) {
      try { await pool.query(sql); applied++; } catch {}
    }

    // ─── Phase 7: Column modifications ──────────────────────────────────────
    try {
      await pool.query(`ALTER TABLE articles ALTER COLUMN "categoryId" DROP NOT NULL`);
      applied++;
    } catch {
      // May already be nullable
    }

    // ─── Phase 8: App settings table ────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          "key" TEXT PRIMARY KEY,
          "value" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
        )
      `);
      applied++;
    } catch {}

    // ─── Phase 9: Foreign key constraints ────────────────────────────────────
    const fkConstraints = [
      // Core auth FKs
      { drop: `ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_userId_fkey`, add: `ALTER TABLE accounts ADD CONSTRAINT accounts_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_userId_fkey`, add: `ALTER TABLE sessions ADD CONSTRAINT sessions_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },

      // Skills & user_skills FKs
      { drop: `ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_userId_fkey`, add: `ALTER TABLE user_skills ADD CONSTRAINT user_skills_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_skillId_fkey`, add: `ALTER TABLE user_skills ADD CONSTRAINT user_skills_skillId_fkey FOREIGN KEY ("skillId") REFERENCES skills(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_parentId_fkey`, add: `ALTER TABLE skills ADD CONSTRAINT skills_parentId_fkey FOREIGN KEY ("parentId") REFERENCES skills(id) ON DELETE SET NULL ON UPDATE CASCADE` },

      // Challenges FKs
      { drop: `ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_skillId_fkey`, add: `ALTER TABLE challenges ADD CONSTRAINT challenges_skillId_fkey FOREIGN KEY ("skillId") REFERENCES skills(id) ON DELETE SET NULL ON UPDATE CASCADE` },
      { drop: `ALTER TABLE challenge_attempts DROP CONSTRAINT IF EXISTS challenge_attempts_userId_fkey`, add: `ALTER TABLE challenge_attempts ADD CONSTRAINT challenge_attempts_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE challenge_attempts DROP CONSTRAINT IF EXISTS challenge_attempts_challengeId_fkey`, add: `ALTER TABLE challenge_attempts ADD CONSTRAINT challenge_attempts_challengeId_fkey FOREIGN KEY ("challengeId") REFERENCES challenges(id) ON DELETE CASCADE ON UPDATE CASCADE` },

      // Daily challenges FKs
      { drop: `ALTER TABLE daily_challenge_assignments DROP CONSTRAINT IF EXISTS daily_challenge_assignments_userId_fkey`, add: `ALTER TABLE daily_challenge_assignments ADD CONSTRAINT daily_challenge_assignments_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE daily_challenge_assignments DROP CONSTRAINT IF EXISTS daily_challenge_assignments_challengeId_fkey`, add: `ALTER TABLE daily_challenge_assignments ADD CONSTRAINT daily_challenge_assignments_challengeId_fkey FOREIGN KEY ("challengeId") REFERENCES challenges(id) ON DELETE CASCADE ON UPDATE CASCADE` },

      // XP logs & achievements FKs
      { drop: `ALTER TABLE xp_logs DROP CONSTRAINT IF EXISTS xp_logs_userId_fkey`, add: `ALTER TABLE xp_logs ADD CONSTRAINT xp_logs_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_userId_fkey`, add: `ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievementId_fkey`, add: `ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_achievementId_fkey FOREIGN KEY ("achievementId") REFERENCES achievements(id) ON DELETE CASCADE ON UPDATE CASCADE` },

      // Knowledge hub FKs
      { drop: `ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_spaceId_fkey`, add: `ALTER TABLE articles ADD CONSTRAINT articles_spaceId_fkey FOREIGN KEY ("spaceId") REFERENCES knowledge_spaces(id) ON DELETE CASCADE ON UPDATE CASCADE` },
      { drop: `ALTER TABLE media DROP CONSTRAINT IF EXISTS media_articleId_fkey`, add: `ALTER TABLE media ADD CONSTRAINT media_articleId_fkey FOREIGN KEY ("articleId") REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE` },
    ];

    for (const fk of fkConstraints) {
      try {
        await pool.query(fk.drop);
        await pool.query(fk.add);
        applied++;
      } catch {
        // FK may already exist with different name
      }
    }

    migrationDone = true;
    console.log(`[DB Migrate] Schema ensured — ${applied} statements applied`);
    return { applied, skipped: false };
  } catch (error) {
    console.error("[DB Migrate] Schema migration error:", error);
    throw error;
  } finally {
    migrationLock = false;
  }
}

/**
 * Ensure a specific column exists on a table (lightweight single-column check).
 * Use this sparingly — prefer `ensureSchema()` for full migrations.
 */
export async function ensureColumn(table: string, column: string, definition: string): Promise<boolean> {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
    return true;
  } catch {
    return false;
  }
}
