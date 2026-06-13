import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

// Auto-migrate: ensure complexityOrder column exists (runs once, then no-op)
let complexityOrderMigrated = false;
async function ensureComplexityOrderColumn() {
  if (complexityOrderMigrated) return;
  complexityOrderMigrated = true;
  try {
    await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS "complexityOrder" INTEGER`);
  } catch {
    // Column already exists
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auto-migrate complexityOrder column on first request
    await ensureComplexityOrderColumn();

    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const recent = searchParams.get("recent");
    const all = searchParams.get("all"); // admin: include unpublished

    // Recent articles across all spaces (for knowledge main page)
    if (recent) {
      const limit = parseInt(recent) || 10;
      const { rows } = await pool.query(
        `SELECT a.id, a.title, a.slug, a.summary, a.tags, a."viewCount", a."spaceId", a."isPublished", a."createdAt",
                a."videoUrl", a."sourceType",
                ks.name as "spaceName", ks.slug as "spaceSlug", ks.icon as "spaceIcon"
         FROM articles a
         LEFT JOIN knowledge_spaces ks ON a."spaceId" = ks.id
         ${all !== "true" ? 'WHERE a."isPublished" = true' : ""}
         ORDER BY a."createdAt" DESC
         LIMIT $1`,
        [limit]
      );

      const result = rows.map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        tags: article.tags,
        viewCount: article.viewCount,
        spaceId: article.spaceId,
        isPublished: article.isPublished,
        createdAt: new Date(article.createdAt).toISOString(),
        spaceName: article.spaceName,
        spaceSlug: article.spaceSlug,
        spaceIcon: article.spaceIcon,
        videoUrl: article.videoUrl,
        sourceType: article.sourceType,
      }));

      return NextResponse.json(result);
    }

    if (!spaceId) {
      return NextResponse.json(
        { error: "Не указан spaceId" },
        { status: 400 }
      );
    }

    // Articles by space — sorted by complexityOrder (easiest first), fallback to createdAt
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.summary, a.tags, a."viewCount", a."spaceId", a."isPublished", a."createdAt", a."videoUrl", a."sourceType", a."complexityOrder", a.difficulty
       FROM articles a
       ${all !== "true" ? 'WHERE a."isPublished" = true AND' : "WHERE"} a."spaceId" = $1
       ORDER BY a."complexityOrder" ASC NULLS LAST, a."createdAt" ASC`,
      [spaceId]
    );

    const result = rows.map((article, idx) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      tags: article.tags,
      viewCount: article.viewCount,
      spaceId: article.spaceId,
      isPublished: article.isPublished,
      createdAt: new Date(article.createdAt).toISOString(),
      videoUrl: article.videoUrl,
      sourceType: article.sourceType,
      complexityOrder: article.complexityOrder ?? (idx + 1),
      difficulty: article.difficulty,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json([]);
  }
}

// POST /api/knowledge/articles — Create article (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      slug,
      content,
      summary,
      tags,
      keyTopics,
      spaceId,
      isPublished,
      // Sprint 6: new fields
      videoUrl,
      pdfUrl,
      pptxUrl,
      sourceUrl,
      sourceType,
      difficulty,
      estimatedTime,
      status,
      aiGenerated,
    } = body;

    if (!title || !slug) {
      return NextResponse.json(
        { error: "title и slug обязательны" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await pool.query(
      `SELECT id FROM articles WHERE slug = $1`,
      [slug]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Статья с таким slug уже существует" },
        { status: 409 }
      );
    }

    const id = 'art_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const authorId = (session.user as Record<string, unknown>).id as string;

    // If spaceId is null, create a temporary "uncategorized" space or use existing one
    let finalSpaceId = spaceId;
    if (!finalSpaceId) {
      // Find or create an "uncategorized" space for AI to categorize later
      const { rows: uncategorizedSpace } = await pool.query(
        `SELECT id FROM knowledge_spaces WHERE slug = 'uncategorized' LIMIT 1`
      );
      if (uncategorizedSpace.length > 0) {
        finalSpaceId = uncategorizedSpace[0].id;
      } else {
        const tempSpaceId = 'sp_uncategorized';
        await pool.query(
          `INSERT INTO knowledge_spaces (id, name, slug, "order", "isPublished", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 999, false, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [tempSpaceId, 'Без категории', 'uncategorized']
        );
        finalSpaceId = tempSpaceId;
      }
    }

    const result = await pool.query(
      `INSERT INTO articles (id, title, slug, content, summary, tags, "keyTopics", "spaceId", "authorId", "isPublished", "viewCount",
         "videoUrl", "pdfUrl", "pptxUrl", "sourceUrl", "sourceType", difficulty, "estimatedTime", status, "aiGenerated",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0,
         $11, $12, $13, $14, $15, $16, $17, $18, $19,
         NOW(), NOW())
       RETURNING *`,
      [
        id,
        title,
        slug,
        content || "",
        summary || null,
        tags ? JSON.stringify(tags) : null,
        keyTopics ? JSON.stringify(keyTopics) : null,
        finalSpaceId,
        authorId,
        isPublished !== undefined ? isPublished : true,
        // Sprint 6 fields
        videoUrl || null,
        pdfUrl || null,
        pptxUrl || null,
        sourceUrl || null,
        sourceType || null,
        difficulty || null,
        estimatedTime || null,
        status || "pending",
        aiGenerated !== undefined ? aiGenerated : false,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Ошибка создания статьи" },
      { status: 500 }
    );
  }
}
