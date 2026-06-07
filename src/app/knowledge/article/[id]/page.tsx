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
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Calendar,
  BookOpen,
  Tag,
  List,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  tags: string | null;
  keyTopics: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    space: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
  relatedGlossary: GlossaryItem[];
}

interface GlossaryItem {
  id: string;
  term: string;
  shortDefinition: string | null;
  category: string | null;
}

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/knowledge/articles/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Extract headings for TOC
  const headings = article?.content
    ? extractHeadings(article.content)
    : [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
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
              {article?.category?.space && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href={`/knowledge/${article.category.space.slug}`}
                      >
                        {article.category.space.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              {article?.category && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href={
                          article.category.space
                            ? `/knowledge/${article.category.space.slug}`
                            : "/knowledge"
                        }
                      >
                        {article.category.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {article?.title || "..."}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </motion.div>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="glass rounded-xl p-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : !article ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Статья не найдена
            </h3>
            <Link
              href="/knowledge"
              className="text-sm text-emerald-400 hover:underline mt-2 inline-block"
            >
              Вернуться к базе знаний
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex gap-8">
            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex-1 min-w-0"
            >
              {/* Article Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold md:text-3xl leading-tight">
                  {article.title}
                </h1>
                {article.summary && (
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {article.summary}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {article.viewCount}{" "}
                    {pluralize(
                      article.viewCount,
                      "просмотр",
                      "просмотра",
                      "просмотров"
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(article.createdAt)}
                  </span>
                  {article.tags && parseTags(article.tags).length > 0 && (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="h-3.5 w-3.5" />
                      {parseTags(article.tags).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-white/10"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Markdown Content */}
              <div className="glass rounded-xl p-6 border-white/5">
                <article className="prose-custom">
                  <ReactMarkdown>{article.content}</ReactMarkdown>
                </article>
              </div>

              {/* Back Link */}
              <div className="mt-6">
                {article.category?.space ? (
                  <Link
                    href={`/knowledge/${article.category.space.slug}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-400 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Назад к {article.category.space.name}
                  </Link>
                ) : (
                  <Link
                    href="/knowledge"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-400 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Назад к базе знаний
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Sidebar — TOC + Related Glossary */}
            {(headings.length > 2 || (article.relatedGlossary && article.relatedGlossary.length > 0)) && (
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="hidden lg:block w-64 shrink-0"
              >
                <div className="sticky top-6 space-y-6">
                  {/* Table of Contents */}
                  {headings.length > 2 && (
                    <div className="glass rounded-xl p-4 border-white/5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <List className="h-3.5 w-3.5" />
                        Содержание
                      </h4>
                      <ScrollArea className="max-h-64">
                        <nav className="space-y-1.5">
                          {headings.map((h, i) => (
                            <a
                              key={i}
                              href={`#${h.id}`}
                              className={cn(
                                "block text-xs text-muted-foreground hover:text-emerald-400 transition-colors",
                                h.level === 3 && "pl-3"
                              )}
                            >
                              {h.text}
                            </a>
                          ))}
                        </nav>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Related Glossary Terms */}
                  {article.relatedGlossary &&
                    article.relatedGlossary.length > 0 && (
                      <div className="glass rounded-xl p-4 border-white/5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5" />
                          Термины
                        </h4>
                        <div className="space-y-2">
                          {article.relatedGlossary.map((term) => (
                            <div key={term.id} className="group">
                              <p className="text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                                {term.term}
                              </p>
                              {term.shortDefinition && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {term.shortDefinition}
                                </p>
                              )}
                              {term.category && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] mt-1 px-1.5 py-0 border-white/10"
                                >
                                  {term.category}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </motion.aside>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function extractHeadings(
  markdown: string
): { id: string; text: string; level: number }[] {
  const lines = markdown.split("\n");
  const headings: { id: string; text: string; level: number }[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\wа-яё]+/gi, "-")
        .replace(/^-|-$/g, "");
      headings.push({ id, text, level: match[1].length });
    }
  }
  return headings;
}

function parseTags(tagsJson: string): string[] {
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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
