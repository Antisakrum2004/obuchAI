export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Загрузка статьи...</p>
        </div>
      </div>
    </div>
  );
}
