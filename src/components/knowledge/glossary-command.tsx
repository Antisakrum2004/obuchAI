"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, ArrowRight, X, FileText, Target, ExternalLink } from "lucide-react";

// ── Types ──

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  shortDefinition: string | null;
  category: string | null;
  relatedTerms: string | null;
  aliases: string | null;
}

interface ArticleResult {
  id: string;
  title: string;
  summary: string | null;
  tags: string[] | null;
  spaceId: string | null;
  spaceName: string | null;
}

interface ChallengeResult {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  type: string | null;
  category: string | null;
}

interface SearchResults {
  glossary: GlossaryTerm[];
  articles: ArticleResult[];
  challenges: ChallengeResult[];
}

// Shared state between GlossaryCommand and GlossaryTrigger
let openGlossaryFn: (() => void) | null = null;

export function useGlossaryOpen() {
  return openGlossaryFn;
}

// ── Keyboard layout switch (EN ↔ RU) ──
const RU_TO_EN: Record<string, string> = {
  'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
  'х':'[','ъ':']',
  'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l',
  'ж':';','э':"'",
  'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m','б':',','ю':'.',
};
const EN_TO_RU: Record<string, string> = Object.fromEntries(
  Object.entries(RU_TO_EN).map(([k, v]) => [v, k])
);

/** Convert a string typed on the wrong keyboard layout */
function switchLayout(str: string, map: Record<string, string>): string {
  return str
    .split("")
    .map((ch) => map[ch.toLowerCase()] || ch)
    .join("");
}

/** Parse aliases JSON field into a string array */
function parseAliases(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((a: unknown) => typeof a === "string") : [];
  } catch {
    return [];
  }
}

/** Parse relatedTerms JSON field into a string array */
function parseRelatedTerms(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// ── Category colors ──
const categoryColors: Record<string, string> = {
  AI: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  Tools: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "1C": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  General: "text-sky-400 border-sky-500/30 bg-sky-500/10",
};

const difficultyColors: Record<string, string> = {
  easy: "text-green-400 border-green-500/30 bg-green-500/10",
  medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  hard: "text-red-400 border-red-500/30 bg-red-500/10",
};

// ── Component ──

export function GlossaryCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>({ glossary: [], articles: [], challenges: [] });
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register the open function for external triggers
  useEffect(() => {
    openGlossaryFn = () => setOpen(true);
    return () => {
      openGlossaryFn = null;
    };
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K (also Ctrl+Л for Russian layout)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "л" || e.key === "K" || e.key === "Л")) {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (!next) {
            setSearch("");
            setSelectedTerm(null);
            setResults({ glossary: [], articles: [], challenges: [] });
          }
          return next;
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle open/close
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearch("");
      setSelectedTerm(null);
      setResults({ glossary: [], articles: [], challenges: [] });
    }
  }, []);

  // Debounced search — calls the server-side search API with layout-switched alternatives
  useEffect(() => {
    if (!search.trim()) {
      setResults({ glossary: [], articles: [], challenges: [] });
      setLoading(false);
      return;
    }

    setLoading(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = search.trim();
        // Compute layout-switched alternatives
        const qAltRu = switchLayout(q, EN_TO_RU);
        const qAltEn = switchLayout(q, RU_TO_EN);

        const alts: string[] = [];
        if (qAltRu !== q.toLowerCase()) alts.push(qAltRu);
        if (qAltEn !== q.toLowerCase() && qAltEn !== qAltRu) alts.push(qAltEn);

        const params = new URLSearchParams({ q });
        if (alts.length > 0) {
          params.set("qAlt", alts.join(","));
        }

        const res = await fetch(`/api/knowledge/search?${params}`);
        if (!res.ok) throw new Error("Search failed");
        const data: SearchResults = await res.json();
        setResults(data);
      } catch {
        setResults({ glossary: [], articles: [], challenges: [] });
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [search]);

  // Handle search input change (just update the search state, effect handles the API call)
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setSelectedTerm(null); // reset detail view when typing
  }, []);

  const handleSelectTerm = useCallback((term: GlossaryTerm) => {
    setSelectedTerm(term);
  }, []);

  const handleNavigateArticle = useCallback((id: string) => {
    setOpen(false);
    setSearch("");
    setSelectedTerm(null);
    router.push(`/knowledge/article/${id}`);
  }, [router]);

  const handleNavigateChallenge = useCallback((id: string) => {
    setOpen(false);
    setSearch("");
    setSelectedTerm(null);
    router.push(`/challenges/${id}`);
  }, [router]);

  const handleRelatedTermClick = useCallback(
    (termName: string) => {
      const found = results.glossary.find(
        (t) => t.term.toLowerCase() === termName.toLowerCase()
      );
      if (found) {
        setSelectedTerm(found);
      }
    },
    [results.glossary]
  );

  // Limit results per type
  const maxPerType = 5;
  const glossarySlice = results.glossary.slice(0, maxPerType);
  const articlesSlice = results.articles.slice(0, maxPerType);
  const challengesSlice = results.challenges.slice(0, maxPerType);
  const hasAnyResults = glossarySlice.length > 0 || articlesSlice.length > 0 || challengesSlice.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Поиск по знаниям"
      description="Термины, статьи и задачи"
      className="sm:max-w-xl"
    >
      <CommandInput
        placeholder="Поиск... (термины, статьи, задачи)"
        onValueChange={handleSearch}
      />
      <CommandList>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mx-auto mb-2" />
            Поиск...
          </div>
        ) : !hasAnyResults && search.trim() ? (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        ) : null}

        {!selectedTerm ? (
          <>
            {/* ── Glossary Terms ── */}
            {glossarySlice.length > 0 && (
              <CommandGroup heading="📖 Термины">
                {glossarySlice.map((term) => (
                  <CommandItem
                    key={term.id}
                    onSelect={() => handleSelectTerm(term)}
                    className="flex items-start gap-3 py-3 px-3 cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {term.term}
                        </span>
                        {term.category && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              categoryColors[term.category] || ""
                            }`}
                          >
                            {term.category}
                          </Badge>
                        )}
                      </div>
                      {term.shortDefinition && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {term.shortDefinition}
                        </p>
                      )}
                      {parseAliases(term.aliases).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {parseAliases(term.aliases).slice(0, 3).map((alias) => (
                            <span key={alias} className="text-[9px] text-muted-foreground/60 bg-white/5 px-1.5 py-0 rounded">
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* ── Articles ── */}
            {articlesSlice.length > 0 && (
              <CommandGroup heading="📄 Статьи">
                {articlesSlice.map((article) => (
                  <CommandItem
                    key={article.id}
                    onSelect={() => handleNavigateArticle(article.id)}
                    className="flex items-start gap-3 py-3 px-3 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {article.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 text-blue-400 border-blue-500/30 bg-blue-500/10"
                        >
                          Статья
                        </Badge>
                      </div>
                      {article.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {article.summary}
                        </p>
                      )}
                      {article.spaceName && (
                        <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">
                          {article.spaceName}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* ── Challenges ── */}
            {challengesSlice.length > 0 && (
              <CommandGroup heading="🎯 Задачи">
                {challengesSlice.map((challenge) => (
                  <CommandItem
                    key={challenge.id}
                    onSelect={() => handleNavigateChallenge(challenge.id)}
                    className="flex items-start gap-3 py-3 px-3 cursor-pointer"
                  >
                    <Target className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {challenge.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 text-orange-400 border-orange-500/30 bg-orange-500/10"
                        >
                          Задача
                        </Badge>
                        {challenge.difficulty && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              difficultyColors[challenge.difficulty] || ""
                            }`}
                          >
                            {challenge.difficulty}
                          </Badge>
                        )}
                      </div>
                      {challenge.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {challenge.description}
                        </p>
                      )}
                      {challenge.category && (
                        <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">
                          {challenge.category}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* ── Empty state (no query) ── */}
            {!search.trim() && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Начните вводить запрос для поиска
              </div>
            )}
          </>
        ) : (
          /* ── Glossary Term Detail View ── */
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {selectedTerm.term}
                </h3>
                {selectedTerm.category && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] mt-1 ${
                      categoryColors[selectedTerm.category] || ""
                    }`}
                  >
                    {selectedTerm.category}
                  </Badge>
                )}
                {parseAliases(selectedTerm.aliases).length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {parseAliases(selectedTerm.aliases).map((alias) => (
                      <span key={alias} className="text-[10px] text-muted-foreground/70 bg-white/5 px-1.5 py-0.5 rounded">
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedTerm(null)}
                className="p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedTerm.definition}
            </p>

            {/* Related Terms */}
            {selectedTerm.relatedTerms &&
              parseRelatedTerms(selectedTerm.relatedTerms).length > 0 && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Связанные термины
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {parseRelatedTerms(selectedTerm.relatedTerms).map(
                        (rt) => {
                          const exists = results.glossary.some(
                            (t) =>
                              t.term.toLowerCase() === rt.toLowerCase()
                          );
                          return exists ? (
                            <button
                              key={rt}
                              onClick={() => handleRelatedTermClick(rt)}
                              className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            >
                              {rt}
                            </button>
                          ) : (
                            <span
                              key={rt}
                              className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground"
                            >
                              {rt}
                            </span>
                          );
                        }
                      )}
                    </div>
                  </div>
                </>
              )}
          </div>
        )}
      </CommandList>

      {/* Footer hint */}
      {!selectedTerm && (
        <div className="border-t border-white/5 px-4 py-2">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono border border-white/10">
              Esc
            </kbd>{" "}
            для закрытия • Поддерживается поиск на обоих раскладках
          </p>
        </div>
      )}
    </CommandDialog>
  );
}
