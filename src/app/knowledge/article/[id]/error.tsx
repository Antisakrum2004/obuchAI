"use client";

// Next.js Error Boundary for /knowledge/article/[id]
// Catches unhandled errors during server rendering and client-side navigation.
// The page ALWAYS opens in the browser — errors are displayed on screen.
export default function ArticleError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="p-8 max-w-2xl mx-auto my-10 bg-red-50 border border-red-200 rounded-lg text-red-700">
      <h1 className="text-xl font-bold mb-2">Критическая ошибка сервера</h1>
      <p className="font-mono text-sm">{error.message || String(error)}</p>
      <p className="text-xs text-gray-500 mt-4">Стек: {error.stack || ""}</p>
      {error.digest && (
        <p className="text-xs text-gray-400 mt-2">Digest: {error.digest}</p>
      )}
    </div>
  );
}
