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
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Eye,
  Calendar,
  BookOpen,
  Tag,
  List,
  ArrowLeft,
  FileIcon,
  Presentation,
  ExternalLink,
  Clock,
  Sparkles,
  ChevronDown,
  Zap,
} from "lucide-react";
import { X, ZoomIn, Download, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MediaUpload } from "@/components/knowledge/media-upload";
import { MediaViewer } from "@/components/knowledge/media-viewer";
import { VideoEmbed } from "@/components/knowledge/video-embed";
import { UrlImportForm } from "@/components/knowledge/url-import-form";
import type { UploadedMedia } from "@/components/knowledge/media-upload";
import { Paperclip } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  difficulty: string | null;
  prerequisites: string | null;
  nextTopics: string | null;
  keyConcepts: string | null;
  estimatedTime: string | null;
  status: string;
  aiGenerated: boolean;
  videoUrl: string | null;
  pdfUrl: string | null;
  pptxUrl: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  processedAt: string | null;
  errorMessage: string | null;
  hasMediaPdf?: boolean;
}

interface GlossaryItem {
  id: string;
  term: string;
  shortDefinition: string | null;
  category: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "border-white/10 text-muted-foreground bg-white/5" },
  processing: { label: "Обработка", color: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
  done: { label: "Готово", color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  error: { label: "Ошибка", color: "border-red-500/30 text-red-400 bg-red-500/10" },
};

const difficultyConfig: Record<string, { label: string; color: string }> = {
  easy: { label: "Легко", color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  medium: { label: "Средне", color: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
  hard: { label: "Сложно", color: "border-red-500/30 text-red-400 bg-red-500/10" },
};

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaKey, setMediaKey] = useState(0);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const { role: storeRole } = useUserStore();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const sessionRole = (session?.user as Record<string, unknown>)?.role;
  const [apiAdmin, setApiAdmin] = useState(false);
  const isAdmin = storeRole === "admin" || sessionRole === "admin" || apiAdmin;

  // Fallback admin check via API (in case store/session haven't loaded yet)
  useEffect(() => {
    if (storeRole === "admin" || sessionRole === "admin") return;
    fetch("/api/user/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role === "admin") setApiAdmin(true);
      })
      .catch(() => {});
  }, [storeRole, sessionRole]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Check if content is still a placeholder
  const isPlaceholderContent = article?.content
    ? article.content.includes("Содержимое будет добавлено после обработки") ||
      article.content.includes("конкретное содержание еще не добавлено")
    : true;

  // Check if article has a PDF available (either pdfUrl or media with PDF)
  const hasPdf = !!(article?.pdfUrl) || !!(article?.hasMediaPdf);

  const handleExtractContent = async () => {
    if (!article) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/knowledge/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, type: "content" }),
      });
      const data = await res.json();
      if (res.ok) {
        // Re-fetch article to show updated content
        const articleRes = await fetch(`/api/knowledge/articles/${encodeURIComponent(article.id)}`);
        if (articleRes.ok) {
          const updated = await articleRes.json();
          setArticle(updated);
        }
        toast.success("Контент успешно извлечён из PDF");
      } else {
        toast.error(data.details || data.error || "Ошибка извлечения контента");
      }
    } catch {
      toast.error("Не удалось извлечь контент");
    } finally {
      setExtracting(false);
    }
  };

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

  // Close lightbox on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && lightboxSrc) {
        setLightboxSrc(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lightboxSrc]);

  // Extract headings for TOC
  const headings = article?.content
    ? extractHeadings(article.content)
    : [];

  // Handle TOC click — smooth scroll to heading
  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, headingId: string) => {
    e.preventDefault();
    const el = document.getElementById(headingId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without jump
      history.replaceState(null, '', `#${headingId}`);
    }
  };

  // Parse keyConcepts from JSON
  const keyConceptsList = article?.keyConcepts
    ? parseJsonString(article.keyConcepts)
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
                <div className="flex items-start gap-3">
                  <h1 className="text-2xl font-bold md:text-3xl leading-tight flex-1">
                    {article.title}
                  </h1>
                  {/* Status Badge (only if not done) */}
                  {article.status && article.status !== "done" && statusConfig[article.status] && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0.5 shrink-0", statusConfig[article.status].color)}
                    >
                      {statusConfig[article.status].label}
                    </Badge>
                  )}
                </div>
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

                {/* Extra Meta Badges Row */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {/* Difficulty Badge */}
                  {article.difficulty && difficultyConfig[article.difficulty] && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", difficultyConfig[article.difficulty].color)}
                    >
                      {difficultyConfig[article.difficulty].label}
                    </Badge>
                  )}

                  {/* Estimated Time */}
                  {article.estimatedTime && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground"
                    >
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {article.estimatedTime}
                    </Badge>
                  )}

                  {/* AI Generated Badge */}
                  {article.aiGenerated && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    >
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      AI
                    </Badge>
                  )}

                  {/* Key Concepts */}
                  {keyConceptsList.length > 0 && (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <Zap className="h-3 w-3 text-emerald-400" />
                      {keyConceptsList.slice(0, 5).map((concept) => (
                        <Badge
                          key={concept}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-emerald-500/20 text-emerald-400/80 bg-emerald-500/5"
                        >
                          {concept}
                        </Badge>
                      ))}
                      {keyConceptsList.length > 5 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground"
                        >
                          +{keyConceptsList.length - 5}
                        </Badge>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* ─── Video Embed Section ─── */}
              {article.videoUrl && (
                <div className="mb-6">
                  <VideoEmbed
                    url={article.videoUrl}
                    sourceType={article.sourceType || undefined}
                    title={article.title}
                  />
                </div>
              )}

              {/* ─── Source Links Section ─── */}
              {(article.pdfUrl || article.pptxUrl || article.sourceUrl) && (
                <div className="mb-6">
                  <div className="glass rounded-xl p-5 border-white/5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-emerald-400" />
                      Материалы и ссылки
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {article.pdfUrl && (
                        <a
                          href={article.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-xs font-medium"
                        >
                          <FileIcon className="h-3.5 w-3.5" />
                          Открыть PDF
                        </a>
                      )}
                      {article.pptxUrl && (
                        <a
                          href={article.pptxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-xs font-medium"
                        >
                          <Presentation className="h-3.5 w-3.5" />
                          Открыть презентацию
                        </a>
                      )}
                      {article.sourceUrl && (
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-xs font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Источник
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Extract Content Banner — admin only, shown when content is placeholder and PDF exists */}
              {isAdmin && isPlaceholderContent && hasPdf && (
                <div className="mb-6">
                  <div className="glass rounded-xl p-5 border-cyan-500/20 bg-cyan-500/[0.03]">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-cyan-400" />
                          Контент статьи ещё не извлечён
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Нажмите кнопку ниже, чтобы AI извлёк текст из PDF и сформировал статью
                        </p>
                      </div>
                      <button
                        onClick={handleExtractContent}
                        disabled={extracting}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Извлечение...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Извлечь контент из PDF
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Markdown Content */}
              <div className="glass rounded-xl p-6 border-white/5">
                <article className="prose-custom">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => {
                        const text = extractTextFromChildren(children);
                        const id = slugifyHeading(text);
                        return <h2 id={id} className="scroll-mt-20">{children}</h2>;
                      },
                      h3: ({ children }) => {
                        const text = extractTextFromChildren(children);
                        const id = slugifyHeading(text);
                        return <h3 id={id} className="scroll-mt-20">{children}</h3>;
                      },
                      img: ({ src, alt }) => (
                        <button
                          onClick={() => {
                            if (src) {
                              setLightboxSrc(typeof src === 'string' ? src : null);
                              setLightboxAlt(alt || "");
                            }
                          }}
                          className="relative group/myimg inline-block cursor-zoom-in w-full my-4"
                          type="button"
                        >
                          { }
                          <img
                            src={src}
                            alt={alt}
                            className="w-full rounded-lg border border-white/10"
                          />
                          <span className="absolute top-2 right-2 opacity-0 group-hover/myimg:opacity-100 transition-opacity bg-black/50 rounded-full p-1.5">
                            <ZoomIn className="h-4 w-4 text-white/80" />
                          </span>
                        </button>
                      ),
                    }}
                  >
                    {article.content}
                  </ReactMarkdown>
                </article>
              </div>

              {/* Media Files */}
              <div className="mt-6">
                <Separator className="mb-4 bg-white/5" />
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Прикреплённые файлы
                </h3>

                {/* Viewer — shows existing files */}
                <MediaViewer
                  key={mediaKey}
                  articleId={id}
                  canDelete={isAdmin}
                  onDelete={() => setMediaKey((k) => k + 1)}
                />

                {/* Upload — admin only */}
                {isAdmin && (
                  <div className="mt-4">
                    <MediaUpload
                      entityType="article"
                      entityId={id}
                      onUploadComplete={() => setMediaKey((k) => k + 1)}
                    />
                  </div>
                )}
              </div>

              {/* URL Import Form — admin only, collapsible */}
              {isAdmin && (
                <div className="mt-6">
                  <Collapsible open={urlImportOpen} onOpenChange={setUrlImportOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-400 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                        Медиа-ссылки
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            urlImportOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <UrlImportForm
                        articleId={id}
                        initialData={{
                          videoUrl: article.videoUrl || undefined,
                          pdfUrl: article.pdfUrl || undefined,
                          pptxUrl: article.pptxUrl || undefined,
                          sourceUrl: article.sourceUrl || undefined,
                          sourceType: article.sourceType || undefined,
                        }}
                        onSave={() => {
                          // Re-fetch article to get updated URLs
                          fetch(`/api/knowledge/articles/${encodeURIComponent(id)}`)
                            .then((r) => r.json())
                            .then((data) => setArticle(data))
                            .catch(() => {});
                        }}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

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
                    <div className="glass rounded-xl p-4 border-white/5 max-h-[60vh] overflow-y-auto">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-sm py-1 -mt-1">
                        <List className="h-3.5 w-3.5" />
                        Содержание
                      </h4>
                      <nav className="space-y-1.5">
                        {headings.map((h, i) => (
                          <a
                            key={i}
                            href={`#${h.id}`}
                            onClick={(e) => handleTocClick(e, h.id)}
                            className={cn(
                              "block text-xs text-muted-foreground hover:text-emerald-400 transition-colors cursor-pointer py-0.5",
                              h.level === 3 && "pl-3"
                            )}
                          >
                            {h.text}
                          </a>
                        ))}
                      </nav>
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

        {/* ═══════ IMAGE LIGHTBOX (for markdown images) ═══════ */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxSrc(null)}
          >
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Закрыть (Esc)"
            >
              <X className="h-5 w-5 text-white" />
            </button>
            <div
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              { }
              <img
                src={lightboxSrc}
                alt={lightboxAlt}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg flex items-center justify-between">
                <p className="text-xs text-white/80 truncate flex-1">{lightboxAlt}</p>
                <a
                  href={lightboxSrc}
                  download={lightboxAlt}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors ml-2"
                  title="Скачать"
                >
                  <Download className="h-3.5 w-3.5 text-white/70" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/** Convert heading text to a URL-safe slug that matches the id attribute in the DOM */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\wа-яё]+/gi, "-")
    .replace(/^-|-$/g, "");
}

/** Extract plain text from React children (handles strings, numbers, arrays, elements) */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren((children as React.ReactElement).props.children);
  }
  return "";
}

function extractHeadings(
  markdown: string
): { id: string; text: string; level: number }[] {
  const lines = markdown.split("\n");
  const headings: { id: string; text: string; level: number }[] = [];
  // Track heading occurrences to avoid duplicate ids
  const idCounts = new Map<string, number>();
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const text = match[2].trim();
      let id = slugifyHeading(text);
      // Handle duplicate ids: append -2, -3, etc.
      const count = idCounts.get(id) || 0;
      idCounts.set(id, count + 1);
      if (count > 0) {
        id = `${id}-${count + 1}`;
      }
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

function parseJsonString(jsonStr: string): string[] {
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
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
