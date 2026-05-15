"use client";

import { useEffect } from "react";

/**
 * Hides the Vercel Toolbar that appears on preview deployments.
 * The toolbar is injected dynamically by Vercel's edge middleware,
 * so we use a MutationObserver to catch and hide it.
 */
export default function VercelToolbarHider() {
  useEffect(() => {
    const hideToolbar = () => {
      // Selectors for all known Vercel toolbar elements
      const selectors = [
        "[data-testid='vercel-toolbar']",
        "[data-vercel-toolbar]",
        ".vc-bottom-bar",
        ".vc-toolbar",
        ".vercel-toolbar",
        "iframe[src*='vercel.com/toolbar']",
        "iframe[src*='vercel-toolbar']",
        // Vercel injects a script tag that creates a shadow DOM container
        "vercel-toolbar",
      ];

      selectors.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.display = "none";
            htmlEl.style.visibility = "hidden";
            htmlEl.style.opacity = "0";
            htmlEl.style.pointerEvents = "none";
            htmlEl.style.position = "absolute";
            htmlEl.style.left = "-9999px";
          });
        } catch {
          // Invalid selector, skip
        }
      });

      // Also hide via custom element tag name
      document.querySelectorAll("*").forEach((el) => {
        if (
          el.tagName?.toLowerCase().includes("vercel-toolbar") ||
          el.id?.includes("vercel-toolbar") ||
          el.className?.toString().includes("vercel-toolbar")
        ) {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.visibility = "hidden";
          htmlEl.style.left = "-9999px";
        }
      });
    };

    // Run immediately
    hideToolbar();

    // Also run after a short delay (toolbar loads asynchronously)
    const timeout1 = setTimeout(hideToolbar, 1000);
    const timeout2 = setTimeout(hideToolbar, 3000);

    // Watch for dynamically injected toolbar elements
    const observer = new MutationObserver(() => {
      hideToolbar();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      observer.disconnect();
    };
  }, []);

  return null; // This component renders nothing
}
