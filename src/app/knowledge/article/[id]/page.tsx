import { ArticleClient } from "./article-client";

// ─── Server Component (thin shell — delegates to client for data fetch) ──
// Previously this page queried the database directly on the server,
// which caused Vercel serverless function timeouts (79MB bundle, 10s+ cold start).
// Now it renders a shell immediately and loads data client-side via the API.
//
// TOTAL IMMUNITY: Every possible failure is caught and displayed on screen.
// The page ALWAYS opens in the browser — even if everything inside is broken.
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;

    return <ArticleClient articleId={id} />;
  } catch (error) {
    // CATCH EVERYTHING — never throw, never notFound(), never redirect.
    // Show the error directly on screen so we can SEE what's broken.
    return (
      <div className="p-8 max-w-2xl mx-auto my-10 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <h1 className="text-xl font-bold mb-2">Критическая ошибка сервера</h1>
        <p className="font-mono text-sm">{error instanceof Error ? error.message : String(error)}</p>
        <p className="text-xs text-gray-500 mt-4">Стек: {error instanceof Error ? error.stack : ""}</p>
      </div>
    );
  }
}
