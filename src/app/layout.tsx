import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ParticlesBackground } from "@/components/effects/particles-background";
import { AppSettingsProvider } from "@/hooks/use-app-settings";

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
          This script runs BEFORE the page renders and kills the Vercel Toolbar.
          Must be in <head> with strategy="beforeInteractive" to run before Vercel injection.
        */}
        <Script id="kill-vercel-toolbar" strategy="beforeInteractive">
          {`
            // Block Vercel Toolbar before it loads
            window.__VERCEL_TOOLBAR_DISABLED = true;
            
            // Intercept and remove Vercel toolbar script/iframe injections
            if (typeof MutationObserver !== 'undefined') {
              var vtObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  mutation.addedNodes.forEach(function(node) {
                    if (node && node.nodeType === 1) {
                      var el = node;
                      var tag = (el.tagName || '').toLowerCase();
                      var id = el.id || '';
                      var cls = el.className || '';
                      var src = el.src || el.getAttribute('src') || '';
                      
                      if (
                        tag.indexOf('vercel') !== -1 ||
                        id.indexOf('vercel') !== -1 ||
                        (typeof cls === 'string' && cls.indexOf('vercel') !== -1) ||
                        src.indexOf('vercel.com/toolbar') !== -1 ||
                        src.indexOf('vercel.live') !== -1
                      ) {
                        el.remove();
                      }
                      
                      // Check shadow DOM hosts
                      if (el.shadowRoot) {
                        var sr = el.shadowRoot;
                        sr.querySelectorAll('*').forEach(function(child) {
                          child.remove();
                        });
                      }
                      
                      // Check children too
                      var children = el.querySelectorAll ? el.querySelectorAll('[id*="vercel"], [class*="vercel"], iframe[src*="vercel"]') : [];
                      children.forEach(function(child) {
                        child.remove();
                      });
                    }
                  });
                });
              });
              
              // Start observing immediately when body is available
              function startObserving() {
                if (document.body) {
                  vtObserver.observe(document.body, { childList: true, subtree: true });
                } else {
                  setTimeout(startObserving, 10);
                }
              }
              startObserving();
            }
            
            // Also periodically clean up
            function cleanupToolbar() {
              document.querySelectorAll('iframe[src*="vercel"], [id*="vercel-toolbar"], [class*="vercel-toolbar"], [data-testid="vercel-toolbar"]').forEach(function(el) {
                el.remove();
              });
            }
            setInterval(cleanupToolbar, 500);
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <AppSettingsProvider>
            <ParticlesBackground />
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
