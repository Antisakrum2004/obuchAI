import { notFound } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArticleClient } from "./article-client";

// ─── Safe JSON helpers ────────────────────────────────────────────
function safeParseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val as T;
}

function safeString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

function safeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  return 0;
}

function safeBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  return false;
}

function safeDate(val: unknown): string {
  if (!val) return new Date().toISOString();
  try { return new Date(val as string | Date).toISOString(); } catch { return new Date().toISOString(); }
}

// ─── Article data type ────────────────────────────────────────────
export interface ArticleData {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  tags: string[];
  keyTopics: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  space: { id: string; name: string; slug: string } | null;
  difficulty: string | null;
  estimatedTime: string | null;
  status: string;
  aiGenerated: boolean;
  videoUrl: string | null;
  pdfUrl: string | null;
  pptxUrl: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  keyConcepts: string[];
  hasMediaPdf: boolean;
}

// ─── Server Component ─────────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Check if user is admin (for showing unpublished articles)
  let isAdmin = false;
  try {
    const session = await getServerSession(authOptions);
    isAdmin = (session?.user as Record<string, unknown>)?.role === "admin";
  } catch {
    // Session check failed — treat as non-admin
  }

  // ─── Fetch article directly from DB ────────────────────────────
  let row: Record<string, any> | undefined;

  try {
    // Try with Sprint 7 JSONB columns first
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.content, a.summary, a.tags,
              a."keyTopics", a."viewCount", a."isPublished", a."createdAt", a."updatedAt",
              a."videoUrl", a."pdfUrl", a."pptxUrl", a."sourceUrl", a."sourceType",
              a.difficulty, a."estimatedTime", a.status, a."aiGenerated",
              a."keyConcepts",
              a."spaceId",
              ks.id AS space_id, ks.name AS space_name, ks.slug AS space_slug
       FROM articles a
       LEFT JOIN knowledge_spaces ks ON a."spaceId" = ks.id
       WHERE a.id = $1`,
      [id]
    );
    row = rows[0];
  } catch (queryErr: any) {
    // If Sprint 7 columns are missing, retry without them
    if (queryErr?.code === "42703" || /does not exist/.test(queryErr?.message || "")) {
      console.warn("[Article Page] Sprint 7 columns missing, using simpler query");
      const { rows } = await pool.query(
        `SELECT a.id, a.title, a.slug, a.content, a.summary, a.tags,
                a."keyTopics", a."viewCount", a."isPublished", a."createdAt", a."updatedAt",
                a."videoUrl", a."pdfUrl", a."pptxUrl", a."sourceUrl", a."sourceType",
                a.difficulty, a."estimatedTime", a.status, a."aiGenerated",
                a."keyConcepts",
                a."spaceId",
                ks.id AS space_id, ks.name AS space_name, ks.slug AS space_slug
         FROM articles a
         LEFT JOIN knowledge_spaces ks ON a."spaceId" = ks.id
         WHERE a.id = $1`,
        [id]
      );
      row = rows[0];
    } else {
      throw queryErr;
    }
  }

  if (!row) {
    notFound();
  }

  // If not published and not admin — 404
  if (!row.isPublished && !isAdmin) {
    notFound();
  }

  // ─── Check for PDF in media table ──────────────────────────────
  let hasMediaPdf = false;
  try {
    if (!row.pdfUrl) {
      const { rows: mediaRows } = await pool.query(
        `SELECT id FROM media WHERE "articleId" = $1 AND "mimeType" LIKE 'application/pdf%' LIMIT 1`,
        [id]
      );
      hasMediaPdf = mediaRows.length > 0;
    }
  } catch {
    // Media check failed — continue without it
  }

  // ─── Increment view count (fire-and-forget) ────────────────────
  if (row.isPublished) {
    pool.query(`UPDATE articles SET "viewCount" = "viewCount" + 1 WHERE id = $1`, [id]).catch(() => {});
  }

  // ─── Assemble safe article data ────────────────────────────────
  const article: ArticleData = {
    id: row.id,
    title: row.title || "",
    slug: row.slug || "",
    content: row.content || "",
    summary: safeString(row.summary),
    tags: safeParseJson<string[]>(row.tags, []),
    keyTopics: safeParseJson<string[]>(row.keyTopics, []),
    viewCount: safeNumber(row.viewCount),
    createdAt: safeDate(row.createdAt),
    updatedAt: safeDate(row.updatedAt),
    space: row.space_id
      ? { id: row.space_id, name: row.space_name, slug: row.space_slug }
      : null,
    difficulty: safeString(row.difficulty),
    estimatedTime: safeString(row.estimatedTime),
    status: row.status || "pending",
    aiGenerated: safeBool(row.aiGenerated),
    videoUrl: safeString(row.videoUrl),
    pdfUrl: safeString(row.pdfUrl),
    pptxUrl: safeString(row.pptxUrl),
    sourceUrl: safeString(row.sourceUrl),
    sourceType: safeString(row.sourceType),
    keyConcepts: safeParseJson<string[]>(row.keyConcepts, []),
    hasMediaPdf,
  };

  return <ArticleClient article={article} isAdmin={isAdmin} />;
}
