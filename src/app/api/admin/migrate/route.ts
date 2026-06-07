import { NextResponse } from 'next/server'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify admin secret (NEXTAUTH_SECRET or fallback to ADMIN_SEED_KEY)
    const body = await request.json().catch(() => ({}))
    const adminSecret = process.env.NEXTAUTH_SECRET
    const fallbackKey = process.env.ADMIN_SEED_KEY || 'seed-v1.5.0'
    if (body.secret !== adminSecret && body.secret !== fallbackKey) {
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

      // Create app_settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      // Seed default settings
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

      // Add missing columns for users and challenge_attempts (these tables already exist)
      const alterStatementsPhase1 = [
        `ALTER TABLE challenge_attempts ADD COLUMN IF NOT EXISTS "timeSpent" INTEGER;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastIp" TEXT;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastUserAgent" TEXT;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastDevice" TEXT;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "consecutiveWrong" INTEGER NOT NULL DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy" TEXT;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0;`,
      ];

      for (const alterSql of alterStatementsPhase1) {
        try {
          await client.query(alterSql)
        } catch (alterErr) {
          console.warn('ALTER Phase 1 warning:', alterErr)
        }
      }

      // ==========================================
      // KNOWLEDGE HUB TABLES
      // ==========================================
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
          "categoryId" TEXT NOT NULL,
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

      // Sprint 6: Add columns to articles and glossary_terms (AFTER tables are created)
      const alterStatementsPhase2 = [
        // Article extensions for AI Content Processing Pipeline
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS difficulty TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS prerequisites TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "nextTopics" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "keyConcepts" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "estimatedTime" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "pptxUrl" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;`,
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS "sourceType" TEXT;`,

        // GlossaryTerm extension
        `ALTER TABLE glossary_terms ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false;`,
      ];

      for (const alterSql of alterStatementsPhase2) {
        try {
          await client.query(alterSql)
        } catch (alterErr) {
          console.warn('ALTER Phase 2 warning:', alterErr)
        }
      }

      // Knowledge Hub foreign keys
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
        try {
          await client.query(fkSql)
        } catch (fkErr) {
          console.warn('Knowledge FK warning (may already exist):', fkErr)
        }
      }

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

      // Sprint 6: Processing Queue table
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
