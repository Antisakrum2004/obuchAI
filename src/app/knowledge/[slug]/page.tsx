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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  ChevronDown,
  FileText,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  articles: ArticleData[];
}

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string | null;
  viewCount: number;
  categoryId: string;
}

interface SpaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

export default function KnowledgeSpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>("");
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    params.then((p) => {
      // Next.js may return URL-encoded slug; decode it to get the actual slug value
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

        // Fetch categories and articles for this space
        const [catRes, artRes] = await Promise.all([
          fetch(
            `/api/knowledge/categories?spaceId=${encodeURIComponent(spaceData.id)}`
          ),
          fetch(
            `/api/knowledge/articles?spaceId=${encodeURIComponent(spaceData.id)}`
          ),
        ]);

        const cats: CategoryData[] = await catRes.json();
        const arts: ArticleData[] = await artRes.json();

        // Group articles by category
        const categoriesWithArticles = cats.map((cat) => ({
          ...cat,
          articles: arts.filter((a) => a.categoryId === cat.id),
        }));

        setCategories(categoriesWithArticles);

        // Auto-open first category
        if (categoriesWithArticles.length > 0) {
          setOpenCategories(new Set([categoriesWithArticles[0].id]));
        }
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
                  <FolderOpen className="h-4 w-4" />
                  {categories.length}{" "}
                  {pluralize(
                    categories.length,
                    "категория",
                    "категории",
                    "категорий"
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {categories.reduce((s, c) => s + c.articles.length, 0)}{" "}
                  {pluralizeR(
                    categories.reduce((s, c) => s + c.articles.length, 0)
                  )}
                </span>
              </div>
            </motion.div>

            {/* Categories with Articles */}
            <div className="space-y-3">
              {categories.map((category, idx) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                >
                  <Collapsible
                    open={openCategories.has(category.id)}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="glass rounded-xl p-4 border-white/5 hover:border-white/10 transition-colors flex items-center gap-3 w-full text-left">
                        <FolderOpen className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {category.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-secondary/50 shrink-0"
                        >
                          {category.articles.length}{" "}
                          {pluralizeR(category.articles.length)}
                        </Badge>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                            openCategories.has(category.id) && "rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 ml-4 space-y-2">
                        {category.articles.length === 0 ? (
                          <p className="text-sm text-muted-foreground/50 py-3 px-4">
                            Статьи пока не добавлены
                          </p>
                        ) : (
                          <ScrollArea className="max-h-96">
                            <div className="space-y-2 pr-2">
                              {category.articles.map((article) => (
                                <Link
                                  key={article.id}
                                  href={`/knowledge/article/${article.id}`}
                                  className="block group"
                                >
                                  <div className="glass rounded-lg p-3 border-white/5 hover:border-emerald-500/20 transition-all flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-400 shrink-0 transition-colors" />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                                        {article.title}
                                      </h4>
                                      {article.summary && (
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                          {article.summary}
                                        </p>
                                      )}
                                    </div>
                                    {article.tags && (
                                      <div className="hidden sm:flex items-center gap-1">
                                        {parseTags(article.tags)
                                          .slice(0, 2)
                                          .map((tag) => (
                                            <Badge
                                              key={tag}
                                              variant="outline"
                                              className="text-[9px] px-1.5 py-0 border-white/10"
                                            >
                                              {tag}
                                            </Badge>
                                          ))}
                                      </div>
                                    )}
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 shrink-0 transition-colors" />
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
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

function pluralize(
  n: number,
  one: string,
  few: string,
  many: string
): string {
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
