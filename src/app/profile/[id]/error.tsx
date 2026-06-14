"use client";

import { useEffect } from "react";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Profile] Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <div className="text-5xl">😵</div>
      <h2 className="text-xl font-semibold text-foreground">Ошибка загрузки профиля</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        Не удалось загрузить данные профиля. Возможно, пользователь не найден или произошла ошибка сервера.
      </p>
      <button
        onClick={reset}
        className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Попробовать снова
      </button>
    </div>
  );
}
