import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <div className="text-6xl">🔍</div>
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        Запрашиваемая страница не существует или была перемещена.
        Попробуйте начать с главной страницы.
      </p>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
        >
          На главную
        </Link>
        <Link
          href="/challenges"
          className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/10 transition-colors"
        >
          К задачам
        </Link>
      </div>
    </div>
  );
}
