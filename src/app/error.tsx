"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-4xl">😕</div>
        <h2 className="text-xl font-bold">Что-то пошло не так</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Произошла ошибка при загрузке страницы. Попробуйте ещё раз.
        </p>
        <Button
          onClick={reset}
          variant="outline"
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          Попробовать снова
        </Button>
      </div>
    </div>
  );
}
