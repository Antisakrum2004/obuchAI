// Migration script: Add aliases to glossary_terms, add spaceId to articles, migrate data
// Run with: npx tsx scripts/migrate-knowledge.ts

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('🚀 Starting knowledge base migration...');

  // 1. Add aliases column to glossary_terms
  console.log('1. Adding aliases column to glossary_terms...');
  try {
    await pool.query(`ALTER TABLE glossary_terms ADD COLUMN IF NOT EXISTS aliases TEXT`);
    console.log('   ✅ aliases column added');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('   ⏭️  aliases column already exists');
    } else {
      throw e;
    }
  }

  // 2. Add spaceId column to articles
  console.log('2. Adding spaceId column to articles...');
  try {
    await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS "spaceId" TEXT`);
    console.log('   ✅ spaceId column added');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('   ⏭️  spaceId column already exists');
    } else {
      throw e;
    }
  }

  // 3. Migrate data: set articles.spaceId from category → space
  console.log('3. Migrating article spaceId from categories...');
  const migrateResult = await pool.query(`
    UPDATE articles a
    SET "spaceId" = c."spaceId"
    FROM categories c
    WHERE a."categoryId" = c.id AND (a."spaceId" IS NULL OR a."spaceId" = '')
  `);
  console.log(`   ✅ Updated ${migrateResult.rowCount} articles with spaceId`);

  // 4. Check for any articles without spaceId
  const orphanCheck = await pool.query(`
    SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NULL OR "spaceId" = ''
  `);
  const orphanCount = parseInt(orphanCheck.rows[0]?.count || '0');
  if (orphanCount > 0) {
    console.log(`   ⚠️  ${orphanCount} articles still without spaceId (orphaned)`);
  } else {
    console.log('   ✅ All articles have spaceId');
  }

  // 5. Add foreign key for spaceId (if all articles have valid spaceId)
  if (orphanCount === 0) {
    console.log('5. Adding foreign key constraint for articles.spaceId...');
    try {
      // Drop old categoryId foreign key first
      await pool.query(`ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_categoryId_fkey`);
      console.log('   ✅ Dropped old categoryId foreign key');

      // Add spaceId foreign key
      await pool.query(`
        ALTER TABLE articles
        ADD CONSTRAINT articles_spaceId_fkey
        FOREIGN KEY ("spaceId") REFERENCES knowledge_spaces(id) ON DELETE CASCADE
      `);
      console.log('   ✅ Added spaceId foreign key');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('   ⏭️  spaceId foreign key already exists');
      } else {
        console.log(`   ⚠️  Could not add foreign key: ${e.message}`);
      }
    }
  }

  // 6. Verify migration
  console.log('\n📊 Verification:');
  const spaceCount = await pool.query(`SELECT COUNT(*) as count FROM knowledge_spaces`);
  const articleCount = await pool.query(`SELECT COUNT(*) as count FROM articles`);
  const glossaryCount = await pool.query(`SELECT COUNT(*) as count FROM glossary_terms`);
  const articleWithSpace = await pool.query(`SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NOT NULL AND "spaceId" != ''`);

  console.log(`   Spaces: ${spaceCount.rows[0]?.count}`);
  console.log(`   Articles: ${articleCount.rows[0]?.count} (with spaceId: ${articleWithSpace.rows[0]?.count})`);
  console.log(`   Glossary terms: ${glossaryCount.rows[0]?.count}`);

  console.log('\n✅ Migration complete!');
  await pool.end();
}

migrate().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
