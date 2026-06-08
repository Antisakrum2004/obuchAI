import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const categoryId = searchParams.get("categoryId");
    const recent = searchParams.get("recent");
    const all = searchParams.get("all"); // admin: include unpublished

    // Recent articles across all spaces (for knowledge main page)
    if (recent) {
      const limit = parseInt(recent) || 10;
      const { rows } = await pool.query(
        `SELECT a.id, a.title, a.slug, a.summary, a.tags, a."viewCount", a."categoryId", a."isPublished", a."createdAt",
                a."videoUrl", a."sourceType",
                c.name as "categoryName", c."spaceId", ks.name as "spaceName", ks.slug as "spaceSlug", ks.icon as "spaceIcon"
         FROM articles a
         JOIN categories c ON a."categoryId" = c.id
         JOIN knowledge_spaces ks ON c."spaceId" = ks.id
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
        categoryId: article.categoryId,
        isPublished: article.isPublished,
        createdAt: new Date(article.createdAt).toISOString(),
        categoryName: article.categoryName,
        spaceId: article.spaceId,
        spaceName: article.spaceName,
        spaceSlug: article.spaceSlug,
        spaceIcon: article.spaceIcon,
        videoUrl: article.videoUrl,
        sourceType: article.sourceType,
      }));

      return NextResponse.json(result);
    }

    if (!spaceId && !categoryId) {
      return NextResponse.json(
        { error: "Не указан spaceId или categoryId" },
        { status: 400 }
      );
    }

    let query: string;
    let params: unknown[];

    if (categoryId) {
      query = `SELECT id, title, slug, summary, tags, "viewCount", "categoryId", "isPublished", "createdAt", "videoUrl", "sourceType"
               FROM articles
               ${all !== "true" ? 'WHERE "isPublished" = true AND' : "WHERE"} "categoryId" = $1
               ORDER BY "createdAt" DESC`;
      params = [categoryId];
    } else {
      query = `SELECT a.id, a.title, a.slug, a.summary, a.tags, a."viewCount", a."categoryId", a."isPublished", a."createdAt", a."videoUrl", a."sourceType"
               FROM articles a
               JOIN categories c ON a."categoryId" = c.id
               ${all !== "true" ? 'WHERE a."isPublished" = true AND' : "WHERE"} c."spaceId" = $1
               ORDER BY a."createdAt" DESC`;
      params = [spaceId];
    }

    const { rows } = await pool.query(query, params);

    const result = rows.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      tags: article.tags,
      viewCount: article.viewCount,
      categoryId: article.categoryId,
      isPublished: article.isPublished,
      createdAt: new Date(article.createdAt).toISOString(),
      videoUrl: article.videoUrl,
      sourceType: article.sourceType,
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
      categoryId,
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

    if (!title || !slug || !categoryId) {
      return NextResponse.json(
        { error: "title, slug и categoryId обязательны" },
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

    const result = await pool.query(
      `INSERT INTO articles (id, title, slug, content, summary, tags, "keyTopics", "categoryId", "authorId", "isPublished", "viewCount",
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
        categoryId,
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
