"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function KnowledgeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Knowledge Error]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-4xl">😕</div>
        <h2 className="text-xl font-bold">Ошибка загрузки</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Не удалось загрузить раздел. Попробуйте ещё раз.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={reset}
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            Попробовать снова
          </Button>
          <Link href="/knowledge">
            <Button variant="outline" className="border-white/10">
              К базе знаний
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
