import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/knowledge/migrate — Run knowledge base migration (admin only, one-time)
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
      logs.push("   ✅ aliases column added");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        logs.push("   ⏭️  aliases column already exists");
      } else {
        logs.push(`   ⚠️  Error: ${e.message}`);
      }
    }

    // 2. Add spaceId column to articles
    logs.push("2. Adding spaceId column to articles...");
    try {
      await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS "spaceId" TEXT`);
      logs.push("   ✅ spaceId column added");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        logs.push("   ⏭️  spaceId column already exists");
      } else {
        logs.push(`   ⚠️  Error: ${e.message}`);
      }
    }

    // 3. Migrate data: set articles.spaceId from category → space
    logs.push("3. Migrating article spaceId from categories...");
    try {
      const migrateResult = await pool.query(`
        UPDATE articles a
        SET "spaceId" = c."spaceId"
        FROM categories c
        WHERE a."categoryId" = c.id AND (a."spaceId" IS NULL OR a."spaceId" = '')
      `);
      logs.push(`   ✅ Updated ${migrateResult.rowCount} articles with spaceId`);
    } catch (e: any) {
      logs.push(`   ⚠️  Error: ${e.message}`);
    }

    // 4. Verify
    logs.push("4. Verification:");
    try {
      const orphanCheck = await pool.query(`
        SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NULL OR "spaceId" = ''
      `);
      const orphanCount = parseInt(orphanCheck.rows[0]?.count || "0");
      logs.push(`   Articles without spaceId: ${orphanCount}`);

      const articleWithSpace = await pool.query(`
        SELECT COUNT(*) as count FROM articles WHERE "spaceId" IS NOT NULL AND "spaceId" != ''
      `);
      logs.push(`   Articles with spaceId: ${articleWithSpace.rows[0]?.count}`);
    } catch (e: any) {
      logs.push(`   ⚠️  Error: ${e.message}`);
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
