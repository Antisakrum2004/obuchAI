import { ArticleClient } from "./article-client";

// ─── Server Component (thin shell — delegates to client for data fetch) ──
// Previously this page queried the database directly on the server,
// which caused Vercel serverless function timeouts (79MB bundle, 10s+ cold start).
// Now it renders a shell immediately and loads data client-side via the API.
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ArticleClient articleId={id} />;
}
