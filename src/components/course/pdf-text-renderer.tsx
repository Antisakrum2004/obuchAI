"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";

// pdfjs-dist is loaded from CDN at runtime (no npm install)
// We use a loose type to avoid TS resolution errors for the CDN import.
type PdfjsModule = {
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<PdfDocument>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    // Dynamic import from esm.sh CDN — no npm install required.
    // Use Function() to bypass TS module resolution (URL imports aren't statically analyzable).
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function(
      "url",
      "return import(url)"
    ) as (url: string) => Promise<unknown>;
    const mod = (await dynamicImport(
      "https://esm.sh/pdfjs-dist@4.7.76"
    )) as PdfjsModule;
    // Configure worker (also from CDN, same version)
    mod.GlobalWorkerOptions.workerSrc =
      "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
    return mod;
  })();
  return pdfjsPromise;
}

// Minimal PDF.js types for the parts we use
interface PdfTextItem {
  str: string;
  transform: number[];
}
interface PdfTextContent {
  items: (PdfTextItem | unknown)[];
}
interface PdfPage {
  getTextContent: () => Promise<PdfTextContent>;
}
interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}

interface PdfTextRendererProps {
  src: string;
}

interface ParsedParagraph {
  text: string;
  // Heading level: 1 = large title, 2 = section heading, 0 = body paragraph
  level: 0 | 1 | 2;
  // True if the line looks like a numbered/bulleted list item
  isListItem: boolean;
}

/**
 * Heuristic: classify a line as heading, list item, or plain paragraph.
 * Keeps basic structure so the rendered text reads as a coherent article.
 */
function classifyLine(raw: string): ParsedParagraph | null {
  const text = raw.trim();
  if (!text) return null;

  // Skip pure page-number-like strings (e.g. "1", "12")
  if (/^\d{1,3}$/.test(text)) return null;

  // Numbered list: "1. ...", "1) ...", "1 - ...", "1—..."
  const numberedMatch = text.match(/^(\d{1,2})[.)\-\u2013\u2014]\s+(.+)$/);
  if (numberedMatch) {
    return {
      text: `${numberedMatch[1]}. ${numberedMatch[2]}`,
      level: 0,
      isListItem: true,
    };
  }

  // Bulleted list: "• ...", "- ...", "* ..."
  const bulletMatch = text.match(/^[\u2022\u25CF\u25AA\u2219\-*]\s+(.+)$/);
  if (bulletMatch) {
    return {
      text: bulletMatch[1],
      level: 0,
      isListItem: true,
    };
  }

  // Heading heuristic: short line (<= 60 chars), no trailing period,
  // may be ALL CAPS or Title Case — treat as section heading
  if (text.length <= 60 && !/[.;,]$/.test(text)) {
    const words = text.split(/\s+/);
    // If line is short and either all uppercase or has 1-3 words, treat as heading
    const isAllCaps = text === text.toUpperCase() && /[A-ZА-Я]/.test(text);
    const isShortTitle = words.length <= 4;
    if (isAllCaps || isShortTitle) {
      // Very short → H1, otherwise H2
      return {
        text,
        level: words.length <= 2 ? 1 : 2,
        isListItem: false,
      };
    }
  }

  return { text, level: 0, isListItem: false };
}

/**
 * Group raw lines from PDF into structured paragraphs.
 * Consecutive non-empty lines that are body text are merged into a paragraph.
 */
function buildParagraphs(rawLines: string[]): ParsedParagraph[] {
  const result: ParsedParagraph[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const merged = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (merged) {
      result.push({ text: merged, level: 0, isListItem: false });
    }
    buffer = [];
  };

  for (const raw of rawLines) {
    const classified = classifyLine(raw);
    if (!classified) {
      // Empty line → paragraph break
      flushBuffer();
      continue;
    }
    if (classified.isListItem || classified.level > 0) {
      // List item or heading — flush any pending body text first
      flushBuffer();
      result.push(classified);
    } else {
      // Body line — accumulate
      buffer.push(classified.text);
    }
  }
  flushBuffer();

  return result;
}

export default function PdfTextRenderer({ src }: PdfTextRendererProps) {
  const [paragraphs, setParagraphs] = useState<ParsedParagraph[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!src) return;

    // Reset state for new document
    setParagraphs(null);
    setLoading(true);
    setError(null);

    // Cancel any in-flight load
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();

        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();

        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;

        const rawLines: string[] = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (controller.signal.aborted) return;
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          // Group text items by their vertical position (transform[5] = y)
          // to reconstruct line breaks. Items on the same y belong to one line.
          const linesByY = new Map<number, { x: number; text: string }[]>();
          for (const item of content.items) {
            // Skip non-text items (e.g. image operators)
            if (!item || typeof item !== "object" || !("str" in item)) continue;
            const textItem = item as PdfTextItem;
            if (!textItem.str) continue;
            // transform: [a, b, c, d, e, f] — e=x, f=y
            const y = Math.round(textItem.transform[5]);
            const x = textItem.transform[4];
            if (!linesByY.has(y)) linesByY.set(y, []);
            linesByY.get(y)!.push({ x, text: textItem.str });
          }
          // Sort lines top-to-bottom (descending y in PDF coords)
          const sortedYs = Array.from(linesByY.keys()).sort((a, b) => b - a);
          for (const y of sortedYs) {
            const items = linesByY.get(y)!;
            // Sort items left-to-right by x
            items.sort((a, b) => a.x - b.x);
            const lineText = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
            if (lineText) rawLines.push(lineText);
          }
          // Add an empty line as page separator (becomes paragraph break)
          rawLines.push("");
        }

        if (controller.signal.aborted) return;

        const structured = buildParagraphs(rawLines);
        setParagraphs(structured);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[PdfTextRenderer] Failed to extract text:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [src]);

  return (
    <div className="p-5 md:p-6 max-h-[700px] overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Извлечение текста из PDF…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-10 text-red-400/70">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="text-sm">Не удалось загрузить описание</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && paragraphs && (
        <div className="space-y-3 text-foreground/90 leading-relaxed">
          {paragraphs.map((p, idx) => {
            if (p.level === 1) {
              return (
                <h2
                  key={idx}
                  className="text-lg md:text-xl font-bold text-foreground mt-4 first:mt-0"
                >
                  {p.text}
                </h2>
              );
            }
            if (p.level === 2) {
              return (
                <h3
                  key={idx}
                  className="text-base md:text-lg font-semibold text-purple-300 mt-3 first:mt-0"
                >
                  {p.text}
                </h3>
              );
            }
            if (p.isListItem) {
              return (
                <div
                  key={idx}
                  className="flex gap-2 pl-2 text-sm md:text-[15px] text-foreground/85"
                >
                  <span className="text-purple-400 select-none flex-shrink-0">•</span>
                  <span className="flex-1">{p.text}</span>
                </div>
              );
            }
            return (
              <p
                key={idx}
                className="text-sm md:text-[15px] text-foreground/85"
              >
                {p.text}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
