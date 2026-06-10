"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Calendar,
  BookOpen,
  Tag,
  FileIcon,
  Presentation,
  ExternalLink,
  Clock,
  Sparkles,
  Zap,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
  Loader2,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { VideoEmbed } from "@/components/knowledge/video-embed";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Config ──────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яёА-ЯЁ-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren(((children as React.ReactElement).props as { children?: React.ReactNode }).children);
  }
  return "";
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(markdown: string): HeadingItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: HeadingItem[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugifyHeading(text);
    headings.push({ id, text, level });
  }
  return headings;
}

// ─── Article data type (from API) ────────────────────────────────
interface ArticleData {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  tags: string[];
  keyTopics: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  space: { id: string; name: string; slug: string } | null;
  difficulty: string | null;
  estimatedTime: string | null;
  status: string;
  aiGenerated: boolean;
  videoUrl: string | null;
  pdfUrl: string | null;
  pptxUrl: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  keyConcepts: string[];
  hasMediaPdf: boolean;
}

// ─── Client Component ────────────────────────────────────────────
export function ArticleClient({
  articleId,
}: {
  articleId: string;
}) {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editSummaryValue, setEditSummaryValue] = useState("");
  const [editContentValue, setEditContentValue] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [contentPreview, setContentPreview] = useState(false);

  const headingIdCountsRef = useRef<Map<string, number>>(new Map());

  // ─── Fetch article data on mount ────────────────────────────────
  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true);
        // Fetch article data via API (client-side, no serverless timeout)
        const [articleRes, sessionRes] = await Promise.all([
          fetch(`/api/knowledge/articles/${encodeURIComponent(articleId)}?all=true`),
          fetch("/api/auth/session"),
        ]);

        if (!articleRes.ok) {
          if (articleRes.status === 404) {
            setError("Статья не найдена");
          } else {
            setError("Ошибка загрузки статьи");
          }
          return;
        }

        const data: ArticleData = await articleRes.json();
        setArticle(data);

        // Check admin status
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          const role = (session?.user as Record<string, string | undefined>)?.role;
          setIsAdmin(role === "admin");
        }
      } catch (err) {
        console.error("[Article Page] Failed to load:", err);
        setError("Не удалось загрузить статью");
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [articleId]);

  // ─── Save handler ────────────────────────────────────────────
  const handleInlineSave = useCallback(async (field: string, value: string) => {
    if (!article) return;
    setSavingField(field);
    try {
      let body: Record<string, unknown> = {};
      if (field === "title") body.title = value;
      else if (field === "summary") body.summary = value || null;
      else if (field === "tags") {
        const tagsList = value.split(",").map((t) => t.trim()).filter(Boolean);
        body.tags = JSON.stringify(tagsList);
      } else if (field === "content") body.content = value;

      const res = await fetch(`/api/knowledge/articles/${encodeURIComponent(article.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Сохранено");
        // Update local state
        setArticle((prev) => prev ? { ...prev, [field]: field === "tags" ? JSON.parse(value || "[]") : value } : prev);
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка сохранения");
      }
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSavingField(null);
    }
  }, [article]);

  // ─── Delete handler ──────────────────────────────────────────
  const handleDeleteArticle = async () => {
    if (!article) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge/articles/${encodeURIComponent(article.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Статья удалена");
        router.push("/knowledge");
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка удаления");
      }
    } catch {
      toast.error("Не удалось удалить статью");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Extract content ─────────────────────────────────────────
  const handleExtractContent = async () => {
    if (!article) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/knowledge/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, type: "content" }),
      });
      if (res.ok) {
        toast.success("Контент извлекается из PDF...");
      } else {
        const data = await res.json();
        toast.error(data.details || data.error || "Ошибка извлечения");
      }
    } catch {
      toast.error("Не удалось извлечь контент");
    } finally {
      setExtracting(false);
    }
  };

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-center h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Загрузка статьи...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Error state ────────────────────────────────────────────
  if (error || !article) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-center h-[50vh]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="text-4xl">📄</div>
              <h2 className="text-xl font-bold">{error || "Статья не найдена"}</h2>
              <Link href="/knowledge">
                <Button variant="outline" className="border-white/10">
                  Вернуться к базе знаний
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Derived state ───────────────────────────────────────────
  const isPlaceholderContent = article.content
    ? article.content.includes("Содержимое будет добавлено после обработки") ||
      article.content.includes("конкретное содержание еще не добавлено")
    : true;

  const hasPdf = !!(article.pdfUrl) || !!(article.hasMediaPdf);

  const headings = useMemo(() =>
    article.content ? extractHeadings(article.content) : [],
    [article.content]
  );

  const keyConceptsList = article.keyConcepts || [];

  const markdownComponents = useMemo(() => ({
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => {
      const text = extractTextFromChildren(children);
      let id = slugifyHeading(text);
      const counts = headingIdCountsRef.current;
      const count = counts.get(id) || 0;
      counts.set(id, count + 1);
      if (count > 0) id = `${id}-${count + 1}`;
      return <h2 id={id} className="scroll-mt-20" {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => {
      const text = extractTextFromChildren(children);
      let id = slugifyHeading(text);
      const counts = headingIdCountsRef.current;
      const count = counts.get(id) || 0;
      counts.set(id, count + 1);
      if (count > 0) id = `${id}-${count + 1}`;
      return <h3 id={id} className="scroll-mt-20" {...props}>{children}</h3>;
    },
    img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img src={src} alt={alt} className="w-full rounded-lg border border-white/10 my-4" {...props} />
    ),
  }), []);

  // ─── Render ──────────────────────────────────────────────────
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
              {article.space && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={`/knowledge/${article.space.slug}`}>
                        {article.space.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{article.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </motion.div>

        {/* Article content */}
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
                {editingTitle ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { handleInlineSave("title", editTitleValue); setEditingTitle(false); }
                        if (e.key === "Escape") setEditingTitle(false);
                      }}
                      autoFocus
                      className="text-2xl font-bold md:text-3xl h-auto py-1"
                      disabled={savingField === "title"}
                    />
                    <Button size="icon" variant="ghost" onClick={() => { handleInlineSave("title", editTitleValue); setEditingTitle(false); }} disabled={savingField === "title"} className="shrink-0 text-emerald-400">
                      {savingField === "title" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)} className="shrink-0 text-muted-foreground">
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h1
                    className={cn("text-2xl font-bold md:text-3xl leading-tight flex-1", isAdmin && "cursor-pointer group/title relative")}
                    onClick={isAdmin ? () => { setEditTitleValue(article.title); setEditingTitle(true); } : undefined}
                  >
                    {article.title}
                    {isAdmin && <Pencil className="inline-block h-4 w-4 ml-2 text-muted-foreground/0 group-hover/title:text-muted-foreground/60 transition-colors" />}
                  </h1>
                )}
                {/* Status Badge */}
                {article.status && article.status !== "done" && statusConfig[article.status] && (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 shrink-0", statusConfig[article.status].color)}>
                    {statusConfig[article.status].label}
                  </Badge>
                )}
                {/* Delete Button */}
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="shrink-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline text-xs">Удалить</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить статью?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Вы уверены, что хотите удалить статью «{article.title}»? Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteArticle} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
                          {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Удаление...</> : "Удалить статью"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {/* Summary */}
              {editingSummary ? (
                <div className="mt-2 flex items-start gap-2">
                  <Textarea
                    value={editSummaryValue}
                    onChange={(e) => setEditSummaryValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) { handleInlineSave("summary", editSummaryValue); setEditingSummary(false); }
                      if (e.key === "Escape") setEditingSummary(false);
                    }}
                    autoFocus rows={2} className="text-sm leading-relaxed resize-none"
                    placeholder="Введите краткое описание..." disabled={savingField === "summary"}
                  />
                  <div className="flex flex-col gap-1 shrink-0 pt-1">
                    <Button size="icon" variant="ghost" onClick={() => { handleInlineSave("summary", editSummaryValue); setEditingSummary(false); }} disabled={savingField === "summary"} className="text-emerald-400 h-7 w-7">
                      {savingField === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingSummary(false)} className="text-muted-foreground h-7 w-7">
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  className={cn("mt-2 text-sm leading-relaxed", article.summary ? "text-muted-foreground" : "text-muted-foreground/50 italic", isAdmin && "cursor-pointer group/summary")}
                  onClick={isAdmin ? () => { setEditSummaryValue(article.summary || ""); setEditingSummary(true); } : undefined}
                >
                  {article.summary || (isAdmin ? "Нажмите, чтобы добавить описание" : "")}
                  {isAdmin && <Pencil className="inline-block h-3 w-3 ml-1.5 text-muted-foreground/0 group-hover/summary:text-muted-foreground/60 transition-colors" />}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {article.viewCount} {pluralize(article.viewCount, "просмотр", "просмотра", "просмотров")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(article.createdAt)}
                </span>
                {article.tags.length > 0 && (
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="h-3.5 w-3.5 shrink-0" />
                    {article.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">{tag}</Badge>
                    ))}
                  </span>
                )}
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {article.difficulty && difficultyConfig[article.difficulty] && (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", difficultyConfig[article.difficulty].color)}>
                    {difficultyConfig[article.difficulty].label}
                  </Badge>
                )}
                {article.estimatedTime && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 mr-1" />{article.estimatedTime}
                  </Badge>
                )}
                {article.aiGenerated && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
                  </Badge>
                )}
                {keyConceptsList.length > 0 && (
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <Zap className="h-3 w-3 text-emerald-400" />
                    {keyConceptsList.slice(0, 5).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/20 text-emerald-400/80 bg-emerald-500/5">{c}</Badge>
                    ))}
                  </span>
                )}
              </div>
            </div>

            {/* Video */}
            {article.videoUrl && (
              <div className="mb-6">
                <VideoEmbed url={article.videoUrl} sourceType={article.sourceType || undefined} title={article.title} />
              </div>
            )}

            {/* Source Links */}
            {(article.pdfUrl || article.pptxUrl || article.sourceUrl) && (
              <div className="mb-6">
                <div className="glass rounded-xl p-5 border-white/5">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-emerald-400" />Материалы и ссылки
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {article.pdfUrl && (
                      <a href={article.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-xs font-medium">
                        <FileIcon className="h-3.5 w-3.5" />Открыть PDF
                      </a>
                    )}
                    {article.pptxUrl && (
                      <a href={article.pptxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-xs font-medium">
                        <Presentation className="h-3.5 w-3.5" />Открыть презентацию
                      </a>
                    )}
                    {article.sourceUrl && (
                      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" />Источник
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Extract Content Banner */}
            {isAdmin && isPlaceholderContent && hasPdf && (
              <div className="mb-6">
                <div className="glass rounded-xl p-5 border-cyan-500/20 bg-cyan-500/[0.03]">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" />Контент статьи ещё не извлечён
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Нажмите кнопку ниже, чтобы AI извлёк текст из PDF</p>
                    </div>
                    <button
                      onClick={handleExtractContent}
                      disabled={extracting}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {extracting ? <><Loader2 className="h-4 w-4 animate-spin" />Извлечение...</> : <><FileText className="h-4 w-4" />Извлечь контент из PDF</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Markdown Content */}
            <div className="glass rounded-xl border-white/5 overflow-hidden">
              {isAdmin && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {editingContent ? "Редактирование" : "Содержимое статьи"}
                  </span>
                  <div className="flex items-center gap-2">
                    {editingContent ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setContentPreview((p) => !p)} className="text-xs h-7 px-2 text-muted-foreground">
                          {contentPreview ? <><Pencil className="h-3 w-3 mr-1" />Редактор</> : <><Eye className="h-3 w-3 mr-1" />Превью</>}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { handleInlineSave("content", editContentValue); setEditingContent(false); }} disabled={savingField === "content"} className="text-xs h-7 px-2 text-emerald-400">
                          {savingField === "content" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}Сохранить
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingContent(false)} className="text-xs h-7 px-2 text-muted-foreground">
                          <XIcon className="h-3 w-3 mr-1" />Отмена
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => { setEditContentValue(article.content || ""); setEditingContent(true); setContentPreview(false); }} className="text-xs h-7 px-2 text-muted-foreground hover:text-emerald-400">
                        <Pencil className="h-3 w-3 mr-1" />Редактировать
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {editingContent && !contentPreview ? (
                <div className="p-4">
                  <Textarea
                    value={editContentValue}
                    onChange={(e) => setEditContentValue(e.target.value)}
                    className="font-mono text-sm min-h-[500px] resize-y bg-transparent border-white/10 focus:border-emerald-500/30"
                    placeholder="Markdown..."
                    disabled={savingField === "content"}
                  />
                </div>
              ) : (
                <div className="p-6">
                  <article className="prose-custom">
                    <ReactMarkdown components={markdownComponents}>
                      {editingContent && contentPreview ? editContentValue : (article.content || "*Содержимое будет добавлено позже*")}
                    </ReactMarkdown>
                  </article>
                </div>
              )}
            </div>
          </motion.div>

          {/* Table of Contents Sidebar */}
          {headings.length > 0 && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:block w-56 shrink-0"
            >
              <div className="sticky top-24 glass rounded-xl p-4 border-white/5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />Содержание
                </h4>
                <nav className="space-y-1">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(h.id);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn(
                        "block text-xs transition-colors hover:text-emerald-400 leading-relaxed",
                        h.level === 2 ? "text-muted-foreground" : "text-muted-foreground/60 pl-3",
                      )}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </motion.aside>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
