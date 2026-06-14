import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Check 1: Session-based admin auth (preferred for UI)
    const session = await getServerSession(authOptions)
    const isSessionAdmin = session?.user && session.user.role === 'admin'

    // Check 2: Key-based auth (for CLI/curl access)
    const body = await request.json().catch(() => ({}))
    const fallbackKey = process.env.ADMIN_SEED_KEY
    const isKeyValid = fallbackKey && body.secret === fallbackKey

    if (!isSessionAdmin && !isKeyValid) {
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
      // ─── Phase 1: CREATE TABLE statements ──────────────────────────────────
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

      // ─── Phase 2: ALTER TABLE via centralized module ────────────────────────
      // Delegate all column additions to the shared db-migrate module
      const { ensureSchema } = await import('@/lib/db-migrate')
      const migrationResult = await ensureSchema()
      console.log('[Admin Migrate] Schema ensured:', migrationResult)

      // ─── Phase 3: App settings table + seed ─────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      await client.query(`
        INSERT INTO app_settings (key, value) VALUES
          ('particles', 'true'),
          ('confetti', 'true'),
          ('liquid_xp', 'true'),
          ('heart_animations', 'true'),
          ('streak_fire', 'true'),
          ('avatar_frames', 'true'),
          ('micro_animations', 'true'),
          ('adaptive_difficulty', 'true')
        ON CONFLICT (key) DO NOTHING;
      `)

      // ─── Phase 4: Knowledge Hub tables ──────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_spaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT,
          "order" INTEGER NOT NULL DEFAULT 0,
          "isPublished" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT,
          "order" INTEGER NOT NULL DEFAULT 0,
          "spaceId" TEXT NOT NULL,
          "parentId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL,
          summary TEXT,
          tags TEXT,
          "keyTopics" TEXT,
          "categoryId" TEXT,
          "authorId" TEXT,
          "isPublished" BOOLEAN NOT NULL DEFAULT false,
          "viewCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS media (
          id TEXT PRIMARY KEY,
          "fileName" TEXT NOT NULL,
          "fileType" TEXT NOT NULL,
          "mimeType" TEXT NOT NULL,
          "fileSize" INTEGER NOT NULL,
          url TEXT NOT NULL,
          "thumbnailUrl" TEXT,
          duration INTEGER,
          "articleId" TEXT,
          "uploadedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS glossary_terms (
          id TEXT PRIMARY KEY,
          term TEXT NOT NULL UNIQUE,
          definition TEXT NOT NULL,
          "shortDefinition" TEXT,
          category TEXT,
          "relatedTerms" TEXT,
          "sourceArticleId" TEXT,
          "order" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // ─── Phase 5: Seed data ────────────────────────────────────────────────

      // Drop Knowledge Hub FK constraints first (they may block seed data insertion)
      const dropKnowledgeFkStatements = [
        `ALTER TABLE media DROP CONSTRAINT IF EXISTS media_articleId_fkey;`,
        `ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_categoryId_fkey;`,
        `ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_spaceId_fkey;`,
        `ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parentId_fkey;`,
      ]

      for (const dropSql of dropKnowledgeFkStatements) {
        try { await client.query(dropSql) } catch {}
      }

      // Clean up orphaned categories
      try {
        await client.query(`DELETE FROM categories WHERE "spaceId" NOT IN (SELECT id FROM knowledge_spaces) AND "spaceId" IS NOT NULL;`)
      } catch {}

      // Seed default knowledge spaces
      await client.query(`
        INSERT INTO knowledge_spaces (id, name, slug, description, icon, "order", "isPublished") VALUES
          ('ks_ai_dev', 'AI Разработка', 'ai-development', 'Инструменты и концепции AI-разработки', '🤖', 1, true),
          ('ks_prompt', 'Промпт-инжиниринг', 'prompt-engineering', 'Техники работы с языковыми моделями', '✍️', 2, true),
          ('ks_1c', '1С и AI', '1c-ai', 'Интеграция AI в экосистему 1С', '🖥️', 3, true),
          ('ks_tools', 'Инструменты', 'tools', 'Cursor, Claude Code, MCP и другие', '🛠️', 4, true)
        ON CONFLICT (slug) DO NOTHING;
      `)

      // Seed default categories
      await client.query(`
        INSERT INTO categories (id, name, slug, description, icon, "spaceId", "order") VALUES
          ('cat_cursor', 'Cursor', 'cursor', 'AI-редактор кода', '🖱️', 'ks_tools', 1),
          ('cat_claude_code', 'Claude Code', 'claude-code', 'AI-ассистент для терминала', '⌨️', 'ks_tools', 2),
          ('cat_openai', 'OpenAI', 'openai', 'GPT, DALL-E, Whisper', '🧠', 'ks_tools', 3),
          ('cat_mcp', 'MCP', 'mcp', 'Model Context Protocol', '🔌', 'ks_tools', 4),
          ('cat_prompt_basics', 'Основы', 'prompt-basics', 'Базовые техники промптинга', '📝', 'ks_prompt', 1),
          ('cat_prompt_advanced', 'Продвинутые', 'prompt-advanced', 'Chain-of-thought, few-shot и др.', '🎯', 'ks_prompt', 2)
        ON CONFLICT (slug) DO NOTHING;
      `)

      // Seed default glossary terms
      await client.query(`
        INSERT INTO glossary_terms (id, term, definition, "shortDefinition", category, "relatedTerms", "order") VALUES
          ('gt_llm', 'LLM', 'Large Language Model — большая языковая модель. Нейронная сеть, обученная на огромных объёмах текста, способная генерировать, анализировать и трансформировать текст. Примеры: GPT-4, Claude, Gemini.', 'Большая языковая модель', 'AI', '["prompt", "rag", "mcp"]', 1),
          ('gt_prompt', 'Промпт', 'Промпт (prompt) — текстовый запрос к языковой модели. От качества промпта напрямую зависит точность и релевантность ответа. Включает контекст, инструкцию, примеры и ограничения.', 'Текстовый запрос к AI', 'AI', '["llm", "prompt-engineering"]', 2),
          ('gt_mcp', 'MCP', 'Model Context Protocol — открытый протокол подключения внешних инструментов и источников данных к LLM. Позволяет моделям взаимодействовать с файлами, API, базами данных.', 'Протокол подключения инструментов к LLM', 'Tools', '["llm", "tool-calling"]', 3),
          ('gt_rag', 'RAG', 'Retrieval-Augmented Generation — метод улучшения ответов LLM путём поиска релевантной информации во внешних источниках перед генерацией ответа.', 'Усиленная поиском генерация', 'AI', '["llm", "vector-database"]', 4),
          ('gt_context_window', 'Context Window', 'Окно контекста — максимальный объём текста (в токенах), который LLM может обработать за один запрос. У GPT-4 — 128K токенов, у Claude 3.5 — 200K токенов.', 'Макс. объём текста для одного запроса', 'AI', '["llm", "token"]', 5),
          ('gt_tool_calling', 'Tool Calling', 'Tool Calling (Function Calling) — способность LLM вызывать внешние функции и API в процессе генерации ответа. Основа для создания AI-агентов.', 'Вызов функций через LLM', 'Tools', '["mcp", "agent"]', 6),
          ('gt_agent', 'AI Агент', 'AI Агент — система, использующая LLM для автономного выполнения задач. Агент планирует, использует инструменты, анализирует результаты и принимает решения.', 'Автономная AI-система', 'AI', '["tool-calling", "mcp"]', 7),
          ('gt_token', 'Токен', 'Токен — минимальная единица текста, которую обрабатывает LLM. Один токен ≈ 0.75 слова на английском, ≈ 0.5 слова на русском. Стоимость API считается за токены.', 'Единица текста для LLM', 'AI', '["llm", "context-window"]', 8),
          ('gt_fine_tuning', 'Fine-tuning', 'Fine-tuning — дообучение предобученной модели на специфичных данных. Позволяет адаптировать модель под конкретную задачу, стиль или домен.', 'Дообучение модели на своих данных', 'AI', '["llm"]', 9),
          ('gt_embedding', 'Embedding', 'Embedding (векторное представление) — числовой вектор, кодирующий смысл текста. Используется для поиска, кластеризации и RAG.', 'Векторное представление текста', 'AI', '["rag", "vector-database"]', 10)
        ON CONFLICT (term) DO NOTHING;
      `)

      // ─── Phase 6: Knowledge Hub foreign keys ────────────────────────────────
      const knowledgeFkStatements = [
        `ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_spaceId_fkey;
         ALTER TABLE categories ADD CONSTRAINT categories_spaceId_fkey FOREIGN KEY ("spaceId") REFERENCES knowledge_spaces(id) ON DELETE CASCADE ON UPDATE CASCADE;`,
        `ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parentId_fkey;
         ALTER TABLE categories ADD CONSTRAINT categories_parentId_fkey FOREIGN KEY ("parentId") REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE;`,
        `ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_categoryId_fkey;
         ALTER TABLE articles ADD CONSTRAINT articles_categoryId_fkey FOREIGN KEY ("categoryId") REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE;`,
        `ALTER TABLE media DROP CONSTRAINT IF EXISTS media_articleId_fkey;
         ALTER TABLE media ADD CONSTRAINT media_articleId_fkey FOREIGN KEY ("articleId") REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE;`,
      ]

      for (const fkSql of knowledgeFkStatements) {
        try { await client.query(fkSql) } catch {}
      }

      // ─── Phase 7: Processing Queue table ────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS processing_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          "articleId" TEXT,
          "inputData" TEXT,
          result TEXT,
          error TEXT,
          progress INTEGER NOT NULL DEFAULT 0,
          "startedAt" TIMESTAMP(3),
          "completedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // ─── Phase 8: Indexes ──────────────────────────────────────────────────
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
        `CREATE INDEX IF NOT EXISTS categories_spaceId_idx ON categories("spaceId");`,
        `CREATE INDEX IF NOT EXISTS categories_parentId_idx ON categories("parentId");`,
        `CREATE INDEX IF NOT EXISTS articles_categoryId_idx ON articles("categoryId");`,
        `CREATE INDEX IF NOT EXISTS articles_isPublished_idx ON articles("isPublished");`,
        `CREATE INDEX IF NOT EXISTS media_articleId_idx ON media("articleId");`,
        `CREATE INDEX IF NOT EXISTS glossary_terms_category_idx ON glossary_terms(category);`,
        `CREATE INDEX IF NOT EXISTS glossary_terms_term_idx ON glossary_terms(term);`,
        `CREATE INDEX IF NOT EXISTS processing_queue_status_idx ON processing_queue(status);`,
        `CREATE INDEX IF NOT EXISTS processing_queue_type_idx ON processing_queue(type);`,
        `CREATE INDEX IF NOT EXISTS processing_queue_articleId_idx ON processing_queue("articleId");`,
        `CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);`,
        `CREATE INDEX IF NOT EXISTS articles_sourceType_idx ON articles("sourceType");`,
      ]

      for (const idxSql of indexStatements) {
        try { await client.query(idxSql) } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Database tables created successfully',
        migrationsApplied: migrationResult.applied,
      })
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
