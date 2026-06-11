export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="glass rounded-xl p-6 space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-5 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
