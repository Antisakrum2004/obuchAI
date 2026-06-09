import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/knowledge/migrate — Run knowledge base migration (admin only)
// Migrates from old categoryId-based schema to spaceId-based 2-level hierarchy
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const logs: string[] = [];

    // 1. Add aliases column to glossary_terms
    logs.push("1. Adding aliases column to glossary_terms...");
    try {
      await pool.query(`ALTER TABLE glossary_terms ADD COLUMN IF NOT EXISTS aliases TEXT`);
      logs.push("   aliases column added or already exists");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 2. Add spaceId column to articles
    logs.push("2. Adding spaceId column to articles...");
    try {
      await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS "spaceId" TEXT`);
      logs.push("   spaceId column added or already exists");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 3. Make categoryId nullable (for transition period)
    logs.push("3. Making categoryId nullable...");
    try {
      await pool.query(`ALTER TABLE articles ALTER COLUMN "categoryId" DROP NOT NULL`);
      logs.push("   categoryId is now nullable");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 4. Migrate data: set articles.spaceId from category -> space
    logs.push("4. Migrating article spaceId from categories...");
    try {
      const migrateResult = await pool.query(`
        UPDATE articles a
        SET "spaceId" = c."spaceId"
        FROM categories c
        WHERE a."categoryId" = c.id AND (a."spaceId" IS NULL OR a."spaceId" = '')
      `);
      logs.push(`   Updated ${migrateResult.rowCount} articles with spaceId from categories`);
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 5. For any articles that still don't have spaceId but have categoryId,
    //    try to find the spaceId from the category table
    logs.push("5. Checking for orphan articles...");
    try {
      const orphanCheck = await pool.query(`
        SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NULL OR "spaceId" = ''
      `);
      const orphanCount = parseInt(orphanCheck.rows[0]?.count || "0");
      logs.push(`   Articles without spaceId: ${orphanCount}`);

      if (orphanCount > 0) {
        // Try to assign to first space as fallback
        const firstSpace = await pool.query(`SELECT id FROM knowledge_spaces ORDER BY "order" ASC LIMIT 1`);
        if (firstSpace.rows.length > 0) {
          const fallbackResult = await pool.query(`
            UPDATE articles SET "spaceId" = $1 WHERE "spaceId" IS NULL OR "spaceId" = ''
          `, [firstSpace.rows[0].id]);
          logs.push(`   Assigned ${fallbackResult.rowCount} orphan articles to first space`);
        }
      }
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 6. Add foreign key for articles.spaceId
    logs.push("6. Adding foreign key for articles.spaceId...");
    try {
      await pool.query(`ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_spaceId_fkey`);
      await pool.query(`ALTER TABLE articles ADD CONSTRAINT articles_spaceId_fkey FOREIGN KEY ("spaceId") REFERENCES knowledge_spaces(id) ON DELETE CASCADE ON UPDATE CASCADE`);
      logs.push("   Foreign key added");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 7. Add index for articles.spaceId
    logs.push("7. Adding index for articles.spaceId...");
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS articles_spaceId_idx ON articles("spaceId")`);
      logs.push("   Index added or already exists");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 8. Add Sprint 6 columns if missing
    logs.push("8. Adding Sprint 6 columns if missing...");
    const sprint6Columns = [
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
    for (const sql of sprint6Columns) {
      try {
        await pool.query(sql);
      } catch {
        // Column may already exist
      }
    }
    logs.push("   Sprint 6 columns checked");

    // 9. Verification
    logs.push("9. Verification:");
    try {
      const articleWithSpace = await pool.query(`
        SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NOT NULL AND "spaceId" != ''
      `);
      logs.push(`   Articles with spaceId: ${articleWithSpace.rows[0]?.count}`);

      const totalArticles = await pool.query(`SELECT COUNT(*) as count FROM articles`);
      logs.push(`   Total articles: ${totalArticles.rows[0]?.count}`);

      const totalSpaces = await pool.query(`SELECT COUNT(*) as count FROM knowledge_spaces`);
      logs.push(`   Total spaces: ${totalSpaces.rows[0]?.count}`);

      const totalGlossary = await pool.query(`SELECT COUNT(*) as count FROM glossary_terms`);
      logs.push(`   Total glossary terms: ${totalGlossary.rows[0]?.count}`);
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
