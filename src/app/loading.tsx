export default function RootLoading() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}
