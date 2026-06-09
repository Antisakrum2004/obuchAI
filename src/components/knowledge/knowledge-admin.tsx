"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Check,
  BookOpen,
  FolderOpen,
  FileText,
  BookA,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Video,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// ── Types ──────────────────────────────────────────────────────

interface SpaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  isPublished: boolean;
  categoryCount: number;
  articleCount: number;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  parentId: string | null;
  spaceId: string;
  articleCount: number;
}

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string | null;
  viewCount: number;
  categoryId: string;
  isPublished: boolean;
  createdAt: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  pptxUrl?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
}

interface GlossaryData {
  id: string;
  term: string;
  definition: string;
  shortDefinition: string | null;
  category: string | null;
  relatedTerms: string | null;
}

type SubTab = "spaces" | "categories" | "articles" | "glossary";

// ── Component ──────────────────────────────────────────────────

export function KnowledgeAdmin() {
  const [subTab, setSubTab] = useState<SubTab>("spaces");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Data
  const [spaces, setSpaces] = useState<SpaceData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [glossary, setGlossary] = useState<GlossaryData[]>([]);

  // Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data Fetching ──────────────────────────────────────────

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/spaces?all=true");
      if (res.ok) {
        const data = await res.json();
        setSpaces(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  const fetchCategories = useCallback(async () => {
    if (spaces.length === 0) return;
    try {
      // Fetch categories for all spaces
      const allCats: CategoryData[] = [];
      for (const space of spaces) {
        const res = await fetch(`/api/knowledge/categories?spaceId=${space.id}&all=true`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) allCats.push(...data);
        }
      }
      setCategories(allCats);
    } catch {}
  }, [spaces]);

  const fetchArticles = useCallback(async () => {
    if (spaces.length === 0) return;
    try {
      const allArts: ArticleData[] = [];
      for (const space of spaces) {
        const res = await fetch(`/api/knowledge/articles?spaceId=${space.id}&all=true`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) allArts.push(...data);
        }
      }
      setArticles(allArts);
    } catch {}
  }, [spaces]);

  const fetchGlossary = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/glossary");
      if (res.ok) {
        const data = await res.json();
        setGlossary(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await fetchSpaces();
    setLoading(false);
  }, [fetchSpaces]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (spaces.length > 0) {
      fetchCategories();
      fetchArticles();
    }
  }, [spaces, fetchCategories, fetchArticles]);

  useEffect(() => {
    fetchGlossary();
  }, [fetchGlossary]);

  // ── Spaces CRUD ─────────────────────────────────────────────

  const emptySpaceForm = { name: "", slug: "", description: "", icon: "", order: 0, isPublished: true };
  const [spaceForm, setSpaceForm] = useState(emptySpaceForm);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceForm, setEditSpaceForm] = useState<Partial<SpaceData>>({});

  const createSpace = async () => {
    if (!spaceForm.name || !spaceForm.slug) { showToast("name и slug обязательны", "err"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spaceForm),
      });
      if (res.ok) {
        showToast("Пространство создано");
        setSpaceForm(emptySpaceForm);
        fetchSpaces();
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка", "err");
      }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const updateSpace = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge/spaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSpaceForm),
      });
      if (res.ok) {
        showToast("Обновлено");
        setEditingSpaceId(null);
        setEditSpaceForm({});
        fetchSpaces();
      } else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const deleteSpace = async (id: string) => {
    if (!confirm("Удалить пространство и все его категории/статьи?")) return;
    try {
      const res = await fetch(`/api/knowledge/spaces/${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Удалено"); fetchSpaces(); }
      else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
  };

  const toggleSpacePublished = async (space: SpaceData) => {
    try {
      const res = await fetch(`/api/knowledge/spaces/${space.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !space.isPublished }),
      });
      if (res.ok) { showToast(space.isPublished ? "Скрыто" : "Опубликовано"); fetchSpaces(); }
    } catch {}
  };

  // ── Categories CRUD ──────────────────────────────────────────

  const emptyCatForm = { name: "", slug: "", description: "", icon: "", order: 0, spaceId: "__none__", parentId: "__none__" };
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState<Partial<CategoryData>>({});

  const createCategory = async () => {
    if (!catForm.name || !catForm.slug || !catForm.spaceId || catForm.spaceId === "__none__") { showToast("name, slug и spaceId обязательны", "err"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...catForm,
          spaceId: catForm.spaceId === "__none__" ? null : catForm.spaceId,
          parentId: catForm.parentId === "__none__" ? null : catForm.parentId,
        }),
      });
      if (res.ok) {
        showToast("Категория создана");
        setCatForm(emptyCatForm);
        fetchCategories();
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка", "err");
      }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const updateCategory = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCatForm),
      });
      if (res.ok) {
        showToast("Обновлено");
        setEditingCatId(null);
        setEditCatForm({});
        fetchCategories();
      } else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Удалить категорию и все её статьи?")) return;
    try {
      const res = await fetch(`/api/knowledge/categories/${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Удалено"); fetchCategories(); fetchArticles(); }
      else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
  };

  // ── Articles CRUD ────────────────────────────────────────────

  const emptyArtForm = { title: "", slug: "", content: "", summary: "", categoryId: "__none__", isPublished: true, tags: "", keyTopics: "", videoUrl: "", pdfUrl: "", pptxUrl: "", sourceUrl: "" };
  const [artForm, setArtForm] = useState(emptyArtForm);
  const [editingArtId, setEditingArtId] = useState<string | null>(null);
  const [editArtForm, setEditArtForm] = useState<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(false);

  const createArticle = async () => {
    if (!artForm.title || !artForm.slug || !artForm.categoryId || artForm.categoryId === "__none__") { showToast("title, slug и categoryId обязательны", "err"); return; }
    setSaving(true);
    try {
      const tags = artForm.tags ? artForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const keyTopics = artForm.keyTopics ? artForm.keyTopics.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: artForm.title,
          slug: artForm.slug,
          content: artForm.content,
          summary: artForm.summary || null,
          categoryId: artForm.categoryId,
          isPublished: artForm.isPublished,
          tags,
          keyTopics,
          videoUrl: artForm.videoUrl || null,
          pdfUrl: artForm.pdfUrl || null,
          pptxUrl: artForm.pptxUrl || null,
          sourceUrl: artForm.sourceUrl || null,
        }),
      });
      if (res.ok) {
        showToast("Статья создана");
        setArtForm(emptyArtForm);
        fetchArticles();
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка", "err");
      }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const updateArticle = async (id: string) => {
    setSaving(true);
    try {
      // Process tags/keyTopics if present
      const body = { ...editArtForm };
      if (typeof body.tags === "string") {
        body.tags = (body.tags as string).split(",").map((t) => t.trim()).filter(Boolean);
      }
      if (typeof body.keyTopics === "string") {
        body.keyTopics = (body.keyTopics as string).split(",").map((t) => t.trim()).filter(Boolean);
      }
      const res = await fetch(`/api/knowledge/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("Статья обновлена");
        setEditingArtId(null);
        setEditArtForm({});
        fetchArticles();
      } else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Удалить статью и прикреплённые файлы?")) return;
    try {
      const res = await fetch(`/api/knowledge/articles/${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Удалено"); fetchArticles(); }
      else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
  };

  const toggleArticlePublished = async (art: ArticleData) => {
    try {
      const res = await fetch(`/api/knowledge/articles/${art.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !art.isPublished }),
      });
      if (res.ok) { showToast(art.isPublished ? "Скрыто" : "Опубликовано"); fetchArticles(); }
    } catch {}
  };

  // ── Glossary CRUD ────────────────────────────────────────────

  const emptyGlossaryForm = { term: "", definition: "", shortDefinition: "", category: "", relatedTerms: "" };
  const [glossaryForm, setGlossaryForm] = useState(emptyGlossaryForm);
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null);
  const [editGlossaryForm, setEditGlossaryForm] = useState<Record<string, unknown>>({});

  const createGlossaryTerm = async () => {
    if (!glossaryForm.term || !glossaryForm.definition) { showToast("term и definition обязательны", "err"); return; }
    setSaving(true);
    try {
      const relatedTerms = glossaryForm.relatedTerms ? glossaryForm.relatedTerms.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const res = await fetch("/api/knowledge/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: glossaryForm.term,
          definition: glossaryForm.definition,
          shortDefinition: glossaryForm.shortDefinition || null,
          category: glossaryForm.category || null,
          relatedTerms,
        }),
      });
      if (res.ok) {
        showToast("Термин создан");
        setGlossaryForm(emptyGlossaryForm);
        fetchGlossary();
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка", "err");
      }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const updateGlossaryTerm = async (id: string) => {
    setSaving(true);
    try {
      const body = { ...editGlossaryForm };
      if (typeof body.relatedTerms === "string") {
        body.relatedTerms = (body.relatedTerms as string).split(",").map((t) => t.trim()).filter(Boolean);
      }
      const res = await fetch(`/api/knowledge/glossary/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("Обновлено");
        setEditingGlossaryId(null);
        setEditGlossaryForm({});
        fetchGlossary();
      } else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
    finally { setSaving(false); }
  };

  const deleteGlossaryTerm = async (id: string) => {
    if (!confirm("Удалить термин?")) return;
    try {
      const res = await fetch(`/api/knowledge/glossary/${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Удалено"); fetchGlossary(); }
      else { showToast("Ошибка", "err"); }
    } catch { showToast("Ошибка сети", "err"); }
  };

  // ── Helper: category name by ID ────────────────────────────

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || id.slice(0, 8);
  const spaceName = (id: string) => spaces.find((s) => s.id === id)?.name || id.slice(0, 8);
  const spaceSlug = (id: string) => spaces.find((s) => s.id === id)?.slug || "";

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all",
          toast.type === "ok" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/5">
        {([
          { key: "spaces", label: "Пространства", icon: BookOpen, count: spaces.length },
          { key: "categories", label: "Категории", icon: FolderOpen, count: categories.length },
          { key: "articles", label: "Статьи", icon: FileText, count: articles.length },
          { key: "glossary", label: "Глоссарий", icon: BookA, count: glossary.length },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
              subTab === key
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="text-[10px] opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* ─── SPACES ──────────────────────────────────────── */}
      {subTab === "spaces" && (
        <div className="space-y-4">
          {/* Create form */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              Новое пространство
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Название" value={spaceForm.name} onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-а-яё]/gi, "") })} className="bg-white/5 border-white/10" />
              <Input placeholder="slug (авто)" value={spaceForm.slug} onChange={(e) => setSpaceForm({ ...spaceForm, slug: e.target.value })} className="bg-white/5 border-white/10" />
              <Input placeholder="Описание" value={spaceForm.description} onChange={(e) => setSpaceForm({ ...spaceForm, description: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2" />
              <div className="flex gap-2 items-end flex-wrap">
                <Input placeholder="Иконка (эмодзи)" value={spaceForm.icon} onChange={(e) => setSpaceForm({ ...spaceForm, icon: e.target.value })} className="bg-white/5 border-white/10 w-28 text-center" />
                <Input type="number" placeholder="Порядок" value={spaceForm.order} onChange={(e) => setSpaceForm({ ...spaceForm, order: Number(e.target.value) })} className="bg-white/5 border-white/10 w-24" />
                <Button onClick={createSpace} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Создать
                </Button>
              </div>
            </div>
          </div>

          {/* Spaces list */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="font-semibold text-sm">Все пространства ({spaces.length})</h3>
            </div>
            {spaces.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет пространств</div>
            ) : spaces.map((space) => (
              <div key={space.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                {editingSpaceId === space.id ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input value={editSpaceForm.name || ""} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, name: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Название" />
                    <Input value={editSpaceForm.description || ""} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, description: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Описание" />
                    <Input value={editSpaceForm.icon || ""} onChange={(e) => setEditSpaceForm({ ...editSpaceForm, icon: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm w-28 text-center" placeholder="Иконка" />
                    <div className="flex gap-2 items-center">
                      <Button size="sm" onClick={() => updateSpace(space.id)} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                        <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingSpaceId(null); setEditSpaceForm({}); }} className="h-8 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{space.icon || "📚"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{space.name}</p>
                      <p className="text-xs text-muted-foreground">
                        /{space.slug} · {space.categoryCount} кат. · {space.articleCount} ст.
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] bg-white/5 border-white/5", space.isPublished ? "text-emerald-400" : "text-muted-foreground")}>
                      {space.isPublished ? "Опубликован" : "Черновик"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggleSpacePublished(space)} className="h-7 w-7 p-0" title={space.isPublished ? "Скрыть" : "Опубликовать"}>
                      {space.isPublished ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingSpaceId(space.id); setEditSpaceForm({ name: space.name, description: space.description || "", icon: space.icon || "" }); }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSpace(space.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── CATEGORIES ──────────────────────────────────── */}
      {subTab === "categories" && (
        <div className="space-y-4">
          {/* Create form */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              Новая категория
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Название" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-а-яё]/gi, "") })} className="bg-white/5 border-white/10" />
              <Input placeholder="slug (авто)" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} className="bg-white/5 border-white/10" />
              <Input placeholder="Описание" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2" />
              <div className="flex gap-2 items-end flex-wrap">
                <Select value={catForm.spaceId} onValueChange={(v) => setCatForm({ ...catForm, spaceId: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 w-48"><SelectValue placeholder="Пространство" /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10">
                    <SelectItem value="__none__" disabled className="text-muted-foreground">Выберите пространство</SelectItem>
                    {spaces.map((s) => (<SelectItem key={s.id} value={s.id}>{s.icon || "📚"} {s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Input placeholder="Иконка" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} className="bg-white/5 border-white/10 w-24 text-center" />
                <Input type="number" placeholder="Порядок" value={catForm.order} onChange={(e) => setCatForm({ ...catForm, order: Number(e.target.value) })} className="bg-white/5 border-white/10 w-24" />
                <Button onClick={createCategory} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Создать
                </Button>
              </div>
            </div>
          </div>

          {/* Categories list */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="font-semibold text-sm">Все категории ({categories.length})</h3>
            </div>
            {categories.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет категорий. Сначала создайте пространство.</div>
            ) : categories.map((cat) => (
              <div key={cat.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                {editingCatId === cat.id ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input value={editCatForm.name || ""} onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Название" />
                    <Input value={editCatForm.description || ""} onChange={(e) => setEditCatForm({ ...editCatForm, description: e.target.value as string | null })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Описание" />
                    <div className="flex gap-2 items-center md:col-span-2">
                      <Button size="sm" onClick={() => updateCategory(cat.id)} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                        <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingCatId(null); setEditCatForm({}); }} className="h-8 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-base">{cat.icon || "📁"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        /{cat.slug} · {spaceName(cat.spaceId)} · {cat.articleCount} ст.
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingCatId(cat.id); setEditCatForm({ name: cat.name, description: cat.description, icon: cat.icon || "" }); }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ARTICLES ────────────────────────────────────── */}
      {subTab === "articles" && (
        <div className="space-y-4">
          {/* Create form */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              Новая статья
            </h3>
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Заголовок" value={artForm.title} onChange={(e) => setArtForm({ ...artForm, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-а-яё]/gi, "") })} className="bg-white/5 border-white/10" />
                <Input placeholder="slug (авто)" value={artForm.slug} onChange={(e) => setArtForm({ ...artForm, slug: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <Input placeholder="Краткое описание" value={artForm.summary} onChange={(e) => setArtForm({ ...artForm, summary: e.target.value })} className="bg-white/5 border-white/10" />
              <div className="grid gap-3 md:grid-cols-2">
                <Select value={artForm.categoryId} onValueChange={(v) => setArtForm({ ...artForm, categoryId: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Категория" /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10">
                    <SelectItem value="__none__" disabled className="text-muted-foreground">Выберите категорию</SelectItem>
                    {spaces.map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled className="font-semibold text-emerald-400">
                        {s.icon || "📚"} {s.name}
                      </SelectItem>
                    ))}
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        ├ {c.icon || "📁"} {c.name} ({spaceName(c.spaceId)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Теги (через запятую)" value={artForm.tags} onChange={(e) => setArtForm({ ...artForm, tags: e.target.value })} className="bg-white/5 border-white/10" />
              </div>

              {/* Markdown Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Содержимое (Markdown)</label>
                  <Button size="sm" variant="ghost" onClick={() => setShowPreview(!showPreview)} className="h-7 text-xs text-muted-foreground">
                    {showPreview ? <><Edit className="h-3 w-3 mr-1" /> Редактор</> : <><Eye className="h-3 w-3 mr-1" /> Превью</>}
                  </Button>
                </div>
                {showPreview ? (
                  <div className="glass rounded-lg p-4 border border-white/5 min-h-[200px] max-h-[500px] overflow-y-auto">
                    <article className="prose-custom">
                      <ReactMarkdown>{artForm.content || "*Пока нет содержимого*"}</ReactMarkdown>
                    </article>
                  </div>
                ) : (
                  <Textarea
                    placeholder="Введите содержимое статьи в Markdown..."
                    value={artForm.content}
                    onChange={(e) => setArtForm({ ...artForm, content: e.target.value })}
                    className="bg-white/5 border-white/10 min-h-[300px] font-mono text-sm"
                  />
                )}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <Input placeholder="Ключевые темы (через запятую)" value={artForm.keyTopics} onChange={(e) => setArtForm({ ...artForm, keyTopics: e.target.value })} className="bg-white/5 border-white/10 flex-1" />
              </div>

              {/* URL Fields */}
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Ссылка на видео (YouTube, Rutube...)" value={artForm.videoUrl} onChange={(e) => setArtForm({ ...artForm, videoUrl: e.target.value })} className="bg-white/5 border-white/10" />
                <Input placeholder="Ссылка на PDF" value={artForm.pdfUrl} onChange={(e) => setArtForm({ ...artForm, pdfUrl: e.target.value })} className="bg-white/5 border-white/10" />
                <Input placeholder="Ссылка на презентацию (PPTX)" value={artForm.pptxUrl} onChange={(e) => setArtForm({ ...artForm, pptxUrl: e.target.value })} className="bg-white/5 border-white/10" />
                <Input placeholder="Ссылка на источник" value={artForm.sourceUrl} onChange={(e) => setArtForm({ ...artForm, sourceUrl: e.target.value })} className="bg-white/5 border-white/10" />
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <Button onClick={createArticle} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Создать статью
                </Button>
              </div>
            </div>
          </div>

          {/* Articles list */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="font-semibold text-sm">Все статьи ({articles.length})</h3>
            </div>
            {articles.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет статей. Сначала создайте пространство и категорию.</div>
            ) : articles.map((art) => (
              <div key={art.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                {editingArtId === art.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={(editArtForm.title as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, title: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Заголовок" />
                      <Input value={(editArtForm.summary as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, summary: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Описание" />
                    </div>
                    <Textarea
                      value={(editArtForm.content as string) || ""}
                      onChange={(e) => setEditArtForm({ ...editArtForm, content: e.target.value })}
                      className="bg-white/5 border-white/10 min-h-[150px] font-mono text-xs"
                      placeholder="Содержимое Markdown"
                    />
                    <Input value={typeof editArtForm.tags === "string" ? editArtForm.tags : (Array.isArray(editArtForm.tags) ? editArtForm.tags.join(", ") : "")} onChange={(e) => setEditArtForm({ ...editArtForm, tags: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Теги (через запятую)" />
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={(editArtForm.videoUrl as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, videoUrl: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Ссылка на видео" />
                      <Input value={(editArtForm.pdfUrl as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, pdfUrl: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Ссылка на PDF" />
                      <Input value={(editArtForm.pptxUrl as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, pptxUrl: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Ссылка на презентацию" />
                      <Input value={(editArtForm.sourceUrl as string) || ""} onChange={(e) => setEditArtForm({ ...editArtForm, sourceUrl: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Ссылка на источник" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button size="sm" onClick={() => updateArticle(art.id)} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                        <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingArtId(null); setEditArtForm({}); }} className="h-8 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{art.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {catName(art.categoryId)} · {art.viewCount} просм.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {art.videoUrl && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-white bg-blue-500/80">
                          <Video className="h-2.5 w-2.5 mr-0.5" />
                          Видео
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn("text-[10px] bg-white/5 border-white/5", art.isPublished ? "text-emerald-400" : "text-muted-foreground")}>
                        {art.isPublished ? "Опубликована" : "Черновик"}
                      </Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggleArticlePublished(art)} className="h-7 w-7 p-0" title={art.isPublished ? "Скрыть" : "Опубликовать"}>
                      {art.isPublished ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      // Fetch full article content for editing
                      const res = await fetch(`/api/knowledge/articles/${art.id}?all=true`);
                      if (res.ok) {
                        const data = await res.json();
                        setEditingArtId(art.id);
                        setEditArtForm({
                          title: data.title,
                          summary: data.summary || "",
                          content: data.content || "",
                          tags: data.tags ? (typeof data.tags === "string" ? data.tags : JSON.parse(data.tags).join(", ")) : "",
                          videoUrl: data.videoUrl || "",
                          pdfUrl: data.pdfUrl || "",
                          pptxUrl: data.pptxUrl || "",
                          sourceUrl: data.sourceUrl || "",
                        });
                      }
                    }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteArticle(art.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── GLOSSARY ────────────────────────────────────── */}
      {subTab === "glossary" && (
        <div className="space-y-4">
          {/* Create form */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              Новый термин
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Термин" value={glossaryForm.term} onChange={(e) => setGlossaryForm({ ...glossaryForm, term: e.target.value })} className="bg-white/5 border-white/10" />
              <Input placeholder="Категория" value={glossaryForm.category} onChange={(e) => setGlossaryForm({ ...glossaryForm, category: e.target.value })} className="bg-white/5 border-white/10" />
              <Textarea placeholder="Определение (полное)" value={glossaryForm.definition} onChange={(e) => setGlossaryForm({ ...glossaryForm, definition: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2 min-h-[80px]" />
              <Textarea placeholder="Краткое определение" value={glossaryForm.shortDefinition} onChange={(e) => setGlossaryForm({ ...glossaryForm, shortDefinition: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2 min-h-[50px]" />
              <Input placeholder="Связанные термины (через запятую)" value={glossaryForm.relatedTerms} onChange={(e) => setGlossaryForm({ ...glossaryForm, relatedTerms: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2" />
              <Button onClick={createGlossaryTerm} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 w-fit">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Создать термин
              </Button>
            </div>
          </div>

          {/* Glossary list */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="font-semibold text-sm">Все термины ({glossary.length})</h3>
            </div>
            {glossary.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет терминов</div>
            ) : glossary.map((term) => (
              <div key={term.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                {editingGlossaryId === term.id ? (
                  <div className="grid gap-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={(editGlossaryForm.term as string) || ""} onChange={(e) => setEditGlossaryForm({ ...editGlossaryForm, term: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Термин" />
                      <Input value={(editGlossaryForm.category as string) || ""} onChange={(e) => setEditGlossaryForm({ ...editGlossaryForm, category: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Категория" />
                    </div>
                    <Textarea value={(editGlossaryForm.definition as string) || ""} onChange={(e) => setEditGlossaryForm({ ...editGlossaryForm, definition: e.target.value })} className="bg-white/5 border-white/10 min-h-[60px] text-sm" placeholder="Определение" />
                    <Textarea value={(editGlossaryForm.shortDefinition as string) || ""} onChange={(e) => setEditGlossaryForm({ ...editGlossaryForm, shortDefinition: e.target.value })} className="bg-white/5 border-white/10 min-h-[40px] text-sm" placeholder="Краткое определение" />
                    <Input value={typeof editGlossaryForm.relatedTerms === "string" ? editGlossaryForm.relatedTerms : (Array.isArray(editGlossaryForm.relatedTerms) ? editGlossaryForm.relatedTerms.join(", ") : "")} onChange={(e) => setEditGlossaryForm({ ...editGlossaryForm, relatedTerms: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Связанные термины" />
                    <div className="flex gap-2 items-center">
                      <Button size="sm" onClick={() => updateGlossaryTerm(term.id)} disabled={saving} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                        <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingGlossaryId(null); setEditGlossaryForm({}); }} className="h-8 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <BookA className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{term.term}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {term.shortDefinition || term.definition}
                      </p>
                      {term.category && (
                        <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0 border-white/10">
                          {term.category}
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingGlossaryId(term.id);
                      setEditGlossaryForm({
                        term: term.term,
                        definition: term.definition,
                        shortDefinition: term.shortDefinition || "",
                        category: term.category || "",
                        relatedTerms: term.relatedTerms ? (typeof term.relatedTerms === "string" ? JSON.parse(term.relatedTerms).join(", ") : "") : "",
                      });
                    }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteGlossaryTerm(term.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
