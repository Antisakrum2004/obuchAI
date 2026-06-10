"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  FileText,
  ArrowRight,
  Video,
  GraduationCap,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useSession } from "next-auth/react";

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string | null;
  viewCount: number;
  spaceId: string;
  videoUrl?: string | null;
  sourceType?: string | null;
  isPublished: boolean;
  createdAt: string;
}

interface SpaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  articleCount: number;
}

export default function KnowledgeSpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // [ETAP-3] Check if client component renders
  console.log("[ETAP-3] KNOWLEDGE SPACE PAGE EXECUTED — client component started");

  const [slug, setSlug] = useState<string>("");
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin detection
  const { role: storeRole } = useUserStore();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const sessionRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
  const isAdmin = storeRole === "admin" || sessionRole === "admin";

  useEffect(() => {
    params.then((p) => {
      const decoded = decodeURIComponent(p.slug);
      setSlug(decoded);
    });
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    async function fetchData() {
      try {
        // Fetch space by slug
        const spaceRes = await fetch(
          `/api/knowledge/spaces?slug=${encodeURIComponent(slug)}`
        );
        const spaceData = await spaceRes.json();

        if (!spaceData.id) {
          setLoading(false);
          return;
        }

        setSpace(spaceData);

        // Fetch articles for this space (include unpublished for admin)
        const artRes = await fetch(
          `/api/knowledge/articles?spaceId=${encodeURIComponent(spaceData.id)}${isAdmin ? "&all=true" : ""}`
        );
        const arts: ArticleData[] = await artRes.json();
        setArticles(arts);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/knowledge">База знаний</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {space?.name || "..."}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
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
        ) : !space ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Раздел не найден
            </h3>
            <Link
              href="/knowledge"
              className="text-sm text-emerald-400 hover:underline mt-2 inline-block"
            >
              Вернуться к базе знаний
            </Link>
          </div>
        ) : (
          <>
            {/* Space Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass rounded-xl p-6 border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0">
                  {space.icon && isEmojiIcon(space.icon) ? (
                    <span className="text-lg">{space.icon}</span>
                  ) : space.icon ? (
                    <span className="text-xs font-bold text-emerald-400">{getAbbrev(space.icon)}</span>
                  ) : (
                    <span className="text-lg">📚</span>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold md:text-2xl">
                    {space.name}
                  </h1>
                  {space.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {space.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {articles.length}{" "}
                  {pluralizeR(articles.length)}
                </span>
              </div>
            </motion.div>

            {/* Articles List */}
            <div className="space-y-3">
              {articles.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Статьи пока не добавлены
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-2 pr-2">
                    {articles.map((article, idx) => (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: idx * 0.05 }}
                      >
                        <div className="glass rounded-xl p-4 border-white/5 hover:border-emerald-500/20 transition-all flex items-center gap-3 group">
                          {/* [ETAP-1] Replaced Link with <a> */}
                          <a
                            href={`/knowledge/${encodeURIComponent(slug)}/learn/${article.id}`}
                            className="shrink-0"
                            onClick={() => console.log("[ETAP-5] learn link href:", `/knowledge/${encodeURIComponent(slug)}/learn/${article.id}`)}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                              <GraduationCap className="h-5 w-5 text-emerald-400" />
                            </div>
                          </a>
                          <div className="flex-1 min-w-0">
                            {/* [ETAP-1] Replaced Link with <a> */}
                            <a href={`/knowledge/${encodeURIComponent(slug)}/learn/${article.id}`} onClick={() => console.log("[ETAP-5] article title href:", `/knowledge/${encodeURIComponent(slug)}/learn/${article.id}`)}>
                              <h3 className="font-medium text-foreground hover:text-emerald-400 transition-colors">
                                {article.title}
                              </h3>
                            </a>
                            {article.summary && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {article.summary}
                              </p>
                            )}
                          </div>
                          <div className="hidden sm:flex items-center gap-1 shrink-0">
                            {article.videoUrl && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-white bg-emerald-500/80">
                                <Video className="h-2.5 w-2.5 mr-0.5" />
                                Видео
                              </Badge>
                            )}
                            {article.tags && parseTags(article.tags).slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 border-white/10"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          {/* [ETAP-1] Replaced Link with <a> */}
                          <a href={`/knowledge/article/${article.id}`} className="shrink-0" onClick={() => console.log("[ETAP-5] article arrow href:", `/knowledge/article/${article.id}`, "[ETAP-6] CLICK on article arrow")}>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/30 hover:text-emerald-400 transition-colors" />
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function parseTags(tagsJson: string): string[] {
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

function isEmojiIcon(str: string): boolean {
  const graphemes = [...str];
  return graphemes.length <= 2 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}

function getAbbrev(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function pluralizeR(n: number): string {
  return pluralize(n, "статья", "статьи", "статей");
}
