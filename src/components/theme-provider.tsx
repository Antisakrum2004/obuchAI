"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="midnight"
      themes={["midnight", "slate"]}
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}
