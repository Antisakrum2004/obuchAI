"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FolderOpen, FileText, ArrowRight, Clock, Eye, Search, Video } from "lucide-react";
import { useGlossaryOpen } from "@/components/knowledge/glossary-command";

interface KnowledgeSpaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  categoryCount: number;
  articleCount: number;
}

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string | null;
  viewCount: number;
  categoryId: string;
  isPublished: boolean;
  createdAt: string;
  categoryName: string;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  spaceIcon: string | null;
  videoUrl?: string | null;
  sourceType?: string | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function KnowledgePage() {
  const openGlossary = useGlossaryOpen();
  const [spaces, setSpaces] = useState<KnowledgeSpaceData[]>([]);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryTerms, setGlossaryTerms] = useState<{id:string;term:string;shortDefinition:string|null;category:string|null}[]>([]);
  const [glossaryResults, setGlossaryResults] = useState<{id:string;term:string;shortDefinition:string|null;category:string|null}[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/knowledge/spaces").then((r) => r.json()),
      fetch("/api/knowledge/articles?recent=6").then((r) => r.json()),
    ])
      .then(([spacesData, articlesData]) => {
        setSpaces(Array.isArray(spacesData) ? spacesData : []);
        setRecentArticles(Array.isArray(articlesData) ? articlesData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load glossary terms on first search focus
  const [glossaryLoaded, setGlossaryLoaded] = useState(false);
  const handleGlossaryFocus = () => {
    if (!glossaryLoaded) {
      fetch("/api/knowledge/glossary")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setGlossaryTerms(data);
            setGlossaryLoaded(true);
          }
        })
        .catch(() => {});
    }
  };

  // Filter glossary on search
  useEffect(() => {
    if (!glossarySearch.trim()) {
      setGlossaryResults([]);
      return;
    }
    const q = glossarySearch.toLowerCase();
    const results = glossaryTerms
      .filter((t) =>
        t.term.toLowerCase().includes(q) ||
        (t.shortDefinition && t.shortDefinition.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      )
      .slice(0, 8);
    setGlossaryResults(results);
  }, [glossarySearch, glossaryTerms]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <BookOpen className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">База знаний</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Справочные материалы, глоссарий и статьи по AI для 1C разработчиков
              </p>
            </div>
          </div>
        </motion.div>

        {/* Glossary Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="relative"
        >
          <div className="glass rounded-xl p-4 border-white/5">
            <div className="flex items-center gap-2 relative">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                onFocus={handleGlossaryFocus}
                placeholder="Поиск по глоссарию..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
              <span className="text-[10px] text-muted-foreground/40 hidden sm:inline">
                Ctrl+K / Ctrl+Л
              </span>
            </div>
          </div>
          {/* Search results dropdown */}
          {glossarySearch.trim() && glossaryResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 glass rounded-xl border border-white/5 z-50 max-h-64 overflow-y-auto">
              {glossaryResults.map((term) => (
                <button
                  key={term.id}
                  onClick={() => {
                    setGlossarySearch("");
                    setGlossaryResults([]);
                    // Open glossary dialog
                    if (openGlossary) openGlossary();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <BookOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{term.term}</span>
                    {term.category && (
                      <span className="ml-2 text-[9px] text-muted-foreground/60">{term.category}</span>
                    )}
                  </div>
                  {term.shortDefinition && (
                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[50%]">{term.shortDefinition}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {glossarySearch.trim() && glossaryLoaded && glossaryResults.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 glass rounded-xl border border-white/5 z-50 p-4 text-center">
              <p className="text-xs text-muted-foreground">Ничего не найдено</p>
            </div>
          )}
        </motion.div>

        {/* Recent Articles */}
        {!loading && recentArticles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Последние статьи
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentArticles.map((article) => (
                <motion.div key={article.id} variants={itemVariants}>
                  <Link href={`/knowledge/article/${article.id}`} className="block group">
                    <Card className="glass card-hover border-white/5 rounded-xl py-0 transition-all duration-300 group-hover:border-emerald-500/30 group-hover:shadow-lg group-hover:shadow-emerald-500/5 h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{article.spaceIcon || "📚"}</span>
                          <Badge variant="secondary" className="text-[9px] bg-secondary/50">
                            {article.categoryName}
                          </Badge>
                          {article.videoUrl && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10 ml-auto">
                              <Video className="h-2.5 w-2.5 mr-0.5" />
                              Видео
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium text-sm text-foreground group-hover:text-emerald-400 transition-colors line-clamp-2 mb-1.5">
                          {article.title}
                        </h3>
                        {article.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex-1">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                          <span className="text-[10px] text-muted-foreground/60">
                            {article.spaceName}
                          </span>
                          {article.viewCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                              <Eye className="h-3 w-3" />
                              {article.viewCount}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Spaces Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Разделы пока не добавлены
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Скоро здесь появятся статьи и материалы
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              Разделы
            </h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2"
            >
              {spaces.map((space) => (
                <motion.div key={space.id} variants={itemVariants}>
                  <Link href={`/knowledge/${space.slug}`} className="block group">
                    <Card className="glass card-hover border-white/5 rounded-xl py-0 transition-all duration-300 group-hover:border-emerald-500/30 group-hover:shadow-lg group-hover:shadow-emerald-500/5">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                            {space.icon && isEmoji(space.icon) ? (
                              <span className="text-lg">{space.icon}</span>
                            ) : space.icon ? (
                              <span className="text-xs font-bold text-emerald-400">{getAbbreviation(space.icon)}</span>
                            ) : (
                              <span className="text-lg">📚</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                              {space.name}
                            </h3>
                            {space.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {space.description}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 flex-wrap">
                          {space.icon && !isEmoji(space.icon) && (
                            <span className="text-[10px] text-muted-foreground/70 font-medium">{space.icon}</span>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 bg-secondary/50"
                          >
                            <FolderOpen className="h-3 w-3" />
                            {space.categoryCount}{" "}
                            {pluralize(space.categoryCount, "кат.", "кат.", "кат.")}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 bg-secondary/50"
                          >
                            <FileText className="h-3 w-3" />
                            {space.articleCount}{" "}
                            {pluralize(space.articleCount, "ст.", "ст.", "ст.")}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Quick Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass rounded-xl p-4 border-white/5"
        >
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="text-lg">💡</span>
            <span>
              Нажмите <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono border border-white/10">Ctrl+K</kbd>{" "}
              или <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono border border-white/10">Ctrl+Л</kbd> для поиска по глоссарию
            </span>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** Check if a string is an emoji (short unicode glyph) vs text label */
function isEmoji(str: string): boolean {
  // Emoji are typically 1-2 JS chars; text labels like "Prompting" are longer
  // Also check: if spreading gives 1 or 2 graphemes, it's likely emoji/symbol
  const graphemes = [...str];
  return graphemes.length <= 2 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(str);
}

/** Get short abbreviation for a text label (1-2 uppercase letters) */
function getAbbreviation(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}
