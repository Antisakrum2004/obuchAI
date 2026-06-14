import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ParticlesBackground } from "@/components/effects/particles-background";
import { AppSettingsProvider } from "@/hooks/use-app-settings";
import { GlossaryCommand } from "@/components/knowledge/glossary-command";
import { GlossaryTrigger } from "@/components/knowledge/glossary-trigger";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Тренажёр для 1C разработчиков",
  description: "Ежедневный AI-тренажёр для 1C разработчиков. Прокачай навыки работы с AI инструментами.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <AppSettingsProvider>
            <Providers>
              <ParticlesBackground />
              <GlossaryCommand />
              <GlossaryTrigger />
              <div className="relative z-[1]">{children}</div>
            </Providers>
          </AppSettingsProvider>
        </ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
