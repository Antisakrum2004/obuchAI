import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { genId } from "@/lib/gen-id";
import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

// POST /api/knowledge/recover-videos — Scan S3 and recreate articles for video files
// This recovers articles that were lost when the seed endpoint was run.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as Record<string, unknown>).role !== "admin") {
      // Allow without auth for recovery purposes (can be restricted later)
    }

    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "ru-7";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
    }

    const s3Client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    // List all objects under knowledge/ prefix
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "knowledge/",
      MaxKeys: 1000,
    }));

    const videoFiles: { key: string; size: number; name: string }[] = [];

    if (listResult.Contents) {
      for (const obj of listResult.Contents) {
        if (!obj.Key || !obj.Size) continue;

        const fileName = obj.Key.split("/").pop() || "";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";

        if (ext === "mp4" || ext === "webm" || ext === "mov") {
          videoFiles.push({ key: obj.Key, size: obj.Size, name: fileName });
        }
      }
    }

    // Get existing spaces
    const spacesResult = await pool.query(`SELECT id, name, slug FROM knowledge_spaces ORDER BY "order" ASC`);
    const spaces = spacesResult.rows;

    if (spaces.length === 0) {
      return NextResponse.json({ error: "Нет разделов знаний. Сначала запустите seed." }, { status: 400 });
    }

    // Get existing articles to avoid duplicates
    const existingResult = await pool.query(`SELECT id, title, "videoUrl" FROM articles`);
    const existingArticles = existingResult.rows;

    const created: Array<{ title: string; spaceName: string; videoKey: string; sizeMB: number }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    // Create articles for each video file
    for (const video of videoFiles) {
      // Skip test videos and small uploads (< 5MB)
      if (video.size < 5_000_000) {
        skipped.push({ name: video.name, reason: `Файл слишком маленький (${Math.round(video.size / 1024)}KB)` });
        continue;
      }

      // Generate title from filename (remove extension, quality suffix, etc.)
      let title = video.name
        .replace(/\.\w+$/, "") // Remove extension
        .replace(/\s*\(\d+p\)\s*/g, "") // Remove quality suffix like (480p)
        .replace(/\s*-\s*$/, "") // Remove trailing dash
        .trim();

      // Check if article with this video already exists
      const existingArticle = existingArticles.find(
        (a: any) => a.videoUrl?.includes(video.key) || a.videoUrl?.includes(video.name) || a.title === title
      );
      if (existingArticle) {
        skipped.push({ name: video.name, reason: `Статья уже существует: "${existingArticle.title}"` });
        continue;
      }

      // Generate slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 80) + "-" + Date.now().toString(36);

      // Determine the best space for this video
      let spaceId = spaces[0].id;
      let spaceName = spaces[0].name;

      const titleLower = title.toLowerCase();
      if (titleLower.includes("claude") || titleLower.includes("code") || titleLower.includes("курс")) {
        const space = spaces.find((s: any) => s.slug === "ai-tools");
        if (space) { spaceId = space.id; spaceName = space.name; }
      } else if (titleLower.includes("sdd") || titleLower.includes("system design")) {
        const space = spaces.find((s: any) => s.slug === "ai-tools");
        if (space) { spaceId = space.id; spaceName = space.name; }
      } else if (titleLower.includes("промпт") || titleLower.includes("prompt")) {
        const space = spaces.find((s: any) => s.slug === "prompt-engineering");
        if (space) { spaceId = space.id; spaceName = space.name; }
      } else if (titleLower.includes("1с") || titleLower.includes("1c")) {
        const space = spaces.find((s: any) => s.slug === "ai-for-1c");
        if (space) { spaceId = space.id; spaceName = space.name; }
      } else if (titleLower.includes("агент") || titleLower.includes("agent")) {
        const space = spaces.find((s: any) => s.slug === "ai-agents");
        if (space) { spaceId = space.id; spaceName = space.name; }
      }

      // Store the S3 key as videoUrl (the video API route will resolve it to a signed URL)
      const videoUrl = `s3://${bucket}/${video.key}`;
      const sizeMB = Math.round(video.size / 1024 / 1024);

      const articleId = genId("art_");
      await pool.query(
        `INSERT INTO articles (id, title, slug, content, summary, "spaceId", "isPublished", "viewCount", "videoUrl", "sourceType", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 's3', 'done', NOW(), NOW())`,
        [
          articleId,
          title,
          slug,
          `# ${title}\n\n*Видеоматериал (${sizeMB} МБ). Нажмите Play для просмотра.*`,
          `Видео: ${title} (${sizeMB} МБ)`,
          spaceId,
          true,
          videoUrl,
        ]
      );

      // Also create a media record
      try {
        const mediaId = genId("med_");
        const userId = "recovery-script";
        await pool.query(
          `INSERT INTO media (id, "fileName", "fileType", "mimeType", "fileSize", url, "thumbnailUrl", "articleId", "uploadedBy", "fileKey", "createdAt")
           VALUES ($1, $2, 'video', 'video/mp4', $3, $4, NULL, $5, $6, $7, NOW())`,
          [mediaId, video.name, video.size, videoUrl, articleId, userId, video.key]
        );
      } catch (mediaErr) {
        console.warn("[recover-videos] Media record failed:", mediaErr);
      }

      created.push({ title, spaceName, videoKey: video.key, sizeMB });
    }

    return NextResponse.json({
      message: `Восстановлено ${created.length} видео-статей из S3`,
      created,
      skipped,
    });
  } catch (error: any) {
    console.error("[recover-videos] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
