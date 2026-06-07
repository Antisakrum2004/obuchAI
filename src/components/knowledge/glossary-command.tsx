"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { BookOpen, ArrowRight, X } from "lucide-react";

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  shortDefinition: string | null;
  category: string | null;
  relatedTerms: string | null;
}

// Shared state between GlossaryCommand and GlossaryTrigger
let openGlossaryFn: (() => void) | null = null;

export function useGlossaryOpen() {
  return openGlossaryFn;
}

export function GlossaryCommand() {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
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
          if (next) {
            // Fetch terms when opening via keyboard
            if (terms.length === 0) {
              fetch("/api/knowledge/glossary")
                .then((r) => r.json())
                .then((data) => {
                  if (Array.isArray(data)) setTerms(data);
                })
                .catch(() => {});
            }
          } else {
            setSearch("");
            setSelectedTerm(null);
          }
          return next;
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [terms.length]);

  // Fetch glossary terms (called from event handlers, not effects)
  const loadTerms = useCallback(() => {
    if (terms.length === 0) {
      fetch("/api/knowledge/glossary")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setTerms(data);
        })
        .catch(() => {});
    }
  }, [terms.length]);

  // Handle open/close + fetch on open
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadTerms();
    } else {
      setSearch("");
      setSelectedTerm(null);
    }
  }, [loadTerms]);

  // Filter terms based on search
  const filteredTerms = terms.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.term.toLowerCase().includes(q) ||
      (t.shortDefinition && t.shortDefinition.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  });

  // Debounced search handler
  const handleSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 150);
  }, []);

  const handleSelectTerm = useCallback((term: GlossaryTerm) => {
    setSelectedTerm(term);
  }, []);

  const handleRelatedTermClick = useCallback(
    (termName: string) => {
      const found = terms.find(
        (t) => t.term.toLowerCase() === termName.toLowerCase()
      );
      if (found) {
        setSelectedTerm(found);
      }
    },
    [terms]
  );

  const categoryColors: Record<string, string> = {
    AI: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    Tools: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    "1C": "text-amber-400 border-amber-500/30 bg-amber-500/10",
    General: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  };

  const parseRelatedTerms = (json: string | null): string[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Глоссарий AI терминов"
      description="Поиск по глоссарию терминов"
      className="sm:max-w-xl"
    >
      <CommandInput
        placeholder="Поиск терминов..."
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        {!selectedTerm ? (
          <CommandGroup heading="Термины">
            {filteredTerms.slice(0, 20).map((term) => (
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
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1" />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <div className="p-4 space-y-4">
            {/* Term Detail View */}
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
                          const exists = terms.some(
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
            для закрытия • Выберите термин для подробностей
          </p>
        </div>
      )}
    </CommandDialog>
  );
}
