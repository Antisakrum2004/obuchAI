import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ParticlesBackground } from "@/components/effects/particles-background";
import { AppSettingsProvider } from "@/hooks/use-app-settings";
import { GlossaryCommand } from "@/components/knowledge/glossary-command";
import { GlossaryTrigger } from "@/components/knowledge/glossary-trigger";

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
      <head>
        {/*
          Lightweight Vercel Toolbar blocker — runs once on load, then stops.
          No MutationObserver, no setInterval — just CSS hiding + one-time cleanup.
        */}
        <Script id="kill-vercel-toolbar" strategy="beforeInteractive">
          {`
            // Block Vercel Toolbar before it loads
            window.__VERCEL_TOOLBAR_DISABLED = true;
            
            // One-time cleanup: remove any existing Vercel elements, then stop.
            // CSS rules in globals.css handle ongoing hiding.
            function cleanupToolbar() {
              var selectors = 'iframe[src*="vercel"], [id*="vercel-toolbar"], [class*="vercel-toolbar"], [data-testid="vercel-toolbar"], [class*="vc-bottom"]';
              document.querySelectorAll(selectors).forEach(function(el) { el.remove(); });
            }
            
            // Run cleanup a few times in the first 3 seconds, then stop entirely
            if (typeof window !== 'undefined') {
              setTimeout(cleanupToolbar, 100);
              setTimeout(cleanupToolbar, 500);
              setTimeout(cleanupToolbar, 1500);
              setTimeout(cleanupToolbar, 3000);
            }
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <AppSettingsProvider>
            <ParticlesBackground />
            <GlossaryCommand />
            <GlossaryTrigger />
            <div className="relative z-[1]">{children}</div>
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
