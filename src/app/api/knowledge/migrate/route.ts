import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureSchema } from "@/lib/db-migrate";

export const dynamic = "force-dynamic";

// POST /api/knowledge/migrate — Run knowledge base migration (admin only)
// Migrates from old categoryId-based schema to spaceId-based 2-level hierarchy
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const logs: string[] = [];

    // Run centralized schema migrations (all ALTER TABLE + FK)
    logs.push("0. Running centralized schema migrations...");
    try {
      const result = await ensureSchema();
      logs.push(`   Schema ensured — ${result.applied} statements applied`);
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 1. Migrate data: set articles.spaceId from category -> space
    logs.push("1. Migrating article spaceId from categories...");
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

    // 2. For any articles that still don't have spaceId but have categoryId,
    //    try to find the spaceId from the category table
    logs.push("2. Checking for orphan articles...");
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

    // 3. Add index for articles.spaceId
    logs.push("3. Adding index for articles.spaceId...");
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS articles_spaceId_idx ON articles("spaceId")`);
      logs.push("   Index added or already exists");
    } catch (e: any) {
      logs.push(`   Warning: ${e.message}`);
    }

    // 4. Verification
    logs.push("4. Verification:");
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
