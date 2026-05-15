import { NextResponse } from 'next/server'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify admin secret
    const body = await request.json().catch(() => ({}))
    const adminSecret = process.env.NEXTAUTH_SECRET
    if (body.secret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
    }

    // Use direct Neon connection for DDL operations
    neonConfig.webSocketConstructor = ws
    const pool = new Pool({ connectionString: databaseUrl })
    const client = await pool.connect()

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          image TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          "githubId" TEXT UNIQUE,
          "emailVerified" TIMESTAMP(3),
          xp INTEGER NOT NULL DEFAULT 0,
          level INTEGER NOT NULL DEFAULT 1,
          streak INTEGER NOT NULL DEFAULT 0,
          "maxStreak" INTEGER NOT NULL DEFAULT 0,
          "lastActiveAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          type TEXT NOT NULL,
          provider TEXT NOT NULL,
          "providerAccountId" TEXT NOT NULL,
          "refresh_token" TEXT,
          "access_token" TEXT,
          "expires_at" INTEGER,
          "token_type" TEXT,
          scope TEXT,
          "id_token" TEXT,
          "session_state" TEXT,
          CONSTRAINT accounts_provider_providerAccountId_key UNIQUE (provider, "providerAccountId")
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          "sessionToken" TEXT NOT NULL UNIQUE,
          "userId" TEXT NOT NULL,
          expires TIMESTAMP(3) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verification_tokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires TIMESTAMP(3) NOT NULL,
          CONSTRAINT verification_tokens_identifier_token_key UNIQUE (identifier, token)
        );

        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          icon TEXT,
          category TEXT NOT NULL,
          "order" INTEGER NOT NULL DEFAULT 0,
          "parentId" TEXT,
          "requiredXp" INTEGER NOT NULL DEFAULT 100,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_skills (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "skillId" TEXT NOT NULL,
          xp INTEGER NOT NULL DEFAULT 0,
          level INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT user_skills_userId_skillId_key UNIQUE ("userId", "skillId")
        );

        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          "xpReward" INTEGER NOT NULL DEFAULT 25,
          content TEXT NOT NULL,
          options TEXT,
          "correctAnswer" TEXT NOT NULL,
          explanation TEXT,
          hints TEXT,
          "validationType" TEXT NOT NULL DEFAULT 'static',
          "validationConfig" TEXT,
          "skillId" TEXT,
          "order" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS challenge_attempts (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "challengeId" TEXT NOT NULL,
          answer TEXT NOT NULL,
          "isCorrect" BOOLEAN NOT NULL,
          "xpEarned" INTEGER NOT NULL DEFAULT 0,
          "timeSpent" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS daily_challenge_assignments (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "challengeId" TEXT NOT NULL,
          date TIMESTAMP(3) NOT NULL,
          completed BOOLEAN NOT NULL DEFAULT false,
          "completedAt" TIMESTAMP(3),
          CONSTRAINT daily_challenge_assignments_userId_date_key UNIQUE ("userId", date)
        );

        CREATE TABLE IF NOT EXISTS xp_logs (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reason TEXT NOT NULL,
          "referenceId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          icon TEXT NOT NULL,
          category TEXT NOT NULL,
          requirement TEXT NOT NULL,
          "xpReward" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_achievements (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "achievementId" TEXT NOT NULL,
          "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT user_achievements_userId_achievementId_key UNIQUE ("userId", "achievementId")
        );
      `)

      // Add foreign keys (separate to avoid issues with table creation order)
      const fkStatements = [
        `ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_userId_fkey;
         ALTER TABLE accounts ADD CONSTRAINT accounts_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_userId_fkey;
         ALTER TABLE sessions ADD CONSTRAINT sessions_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_userId_fkey;
         ALTER TABLE user_skills ADD CONSTRAINT user_skills_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_skillId_fkey;
         ALTER TABLE user_skills ADD CONSTRAINT user_skills_skillId_fkey FOREIGN KEY ("skillId") REFERENCES skills(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_parentId_fkey;
         ALTER TABLE skills ADD CONSTRAINT skills_parentId_fkey FOREIGN KEY ("parentId") REFERENCES skills(id) ON DELETE SET NULL ON UPDATE CASCADE;`,

        `ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_skillId_fkey;
         ALTER TABLE challenges ADD CONSTRAINT challenges_skillId_fkey FOREIGN KEY ("skillId") REFERENCES skills(id) ON DELETE SET NULL ON UPDATE CASCADE;`,

        `ALTER TABLE challenge_attempts DROP CONSTRAINT IF EXISTS challenge_attempts_userId_fkey;
         ALTER TABLE challenge_attempts ADD CONSTRAINT challenge_attempts_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE challenge_attempts DROP CONSTRAINT IF EXISTS challenge_attempts_challengeId_fkey;
         ALTER TABLE challenge_attempts ADD CONSTRAINT challenge_attempts_challengeId_fkey FOREIGN KEY ("challengeId") REFERENCES challenges(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE daily_challenge_assignments DROP CONSTRAINT IF EXISTS daily_challenge_assignments_userId_fkey;
         ALTER TABLE daily_challenge_assignments ADD CONSTRAINT daily_challenge_assignments_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE daily_challenge_assignments DROP CONSTRAINT IF EXISTS daily_challenge_assignments_challengeId_fkey;
         ALTER TABLE daily_challenge_assignments ADD CONSTRAINT daily_challenge_assignments_challengeId_fkey FOREIGN KEY ("challengeId") REFERENCES challenges(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE xp_logs DROP CONSTRAINT IF EXISTS xp_logs_userId_fkey;
         ALTER TABLE xp_logs ADD CONSTRAINT xp_logs_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_userId_fkey;
         ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;`,

        `ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievementId_fkey;
         ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_achievementId_fkey FOREIGN KEY ("achievementId") REFERENCES achievements(id) ON DELETE CASCADE ON UPDATE CASCADE;`,
      ]

      for (const fkSql of fkStatements) {
        try {
          await client.query(fkSql)
        } catch (fkErr) {
          console.warn('FK warning (may already exist):', fkErr)
        }
      }

      // Add missing columns (safe ALTER TABLE for tables that already exist)
      const alterStatements = [
        `ALTER TABLE challenge_attempts ADD COLUMN IF NOT EXISTS "timeSpent" INTEGER;`,
      ];

      for (const alterSql of alterStatements) {
        try {
          await client.query(alterSql)
        } catch (alterErr) {
          console.warn('ALTER warning:', alterErr)
        }
      }

      // Create indexes
      const indexStatements = [
        `CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts("userId");`,
        `CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions("userId");`,
        `CREATE INDEX IF NOT EXISTS user_skills_userId_idx ON user_skills("userId");`,
        `CREATE INDEX IF NOT EXISTS user_skills_skillId_idx ON user_skills("skillId");`,
        `CREATE INDEX IF NOT EXISTS challenges_skillId_idx ON challenges("skillId");`,
        `CREATE INDEX IF NOT EXISTS challenge_attempts_userId_idx ON challenge_attempts("userId");`,
        `CREATE INDEX IF NOT EXISTS challenge_attempts_challengeId_idx ON challenge_attempts("challengeId");`,
        `CREATE INDEX IF NOT EXISTS daily_challenge_assignments_userId_idx ON daily_challenge_assignments("userId");`,
        `CREATE INDEX IF NOT EXISTS xp_logs_userId_idx ON xp_logs("userId");`,
        `CREATE INDEX IF NOT EXISTS user_achievements_userId_idx ON user_achievements("userId");`,
        `CREATE INDEX IF NOT EXISTS user_achievements_achievementId_idx ON user_achievements("achievementId");`,
      ]

      for (const idxSql of indexStatements) {
        try {
          await client.query(idxSql)
        } catch (idxErr) {
          console.warn('Index warning:', idxErr)
        }
      }

      return NextResponse.json({ success: true, message: 'Database tables created successfully' })
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    )
  }
}
