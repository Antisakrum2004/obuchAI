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
  aliases: string | null;
}

let openGlossaryFn: (() => void) | null = null;
export function useGlossaryOpen() { return openGlossaryFn; }

// ── Keyboard layout switch (EN ↔ RU physical keys) ──
const RU_TO_EN: Record<string, string> = {
  'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
  'х':'[','ъ':']','ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k',
  'д':'l','ж':';','э':"'",'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m',
  'б':',','ю':'.',
};
const EN_TO_RU: Record<string, string> = Object.fromEntries(
  Object.entries(RU_TO_EN).map(([k, v]) => [v, k])
);

// ── Multi-mapping Cyrillic → Latin (phonetic + visual) ──
// Each Cyrillic char maps to multiple Latin interpretations
// This makes "раг" → "rag" (phonetic) AND "мсп" → "mcp" (visual)
const CYR_MULTI_LAT: Record<string, string[]> = {
  'а': ['a'], 'б': ['b'], 'в': ['v', 'b'], 'г': ['g'], 'д': ['d'],
  'е': ['e', 'ye'], 'ё': ['yo', 'e'], 'ж': ['zh', 'j'], 'з': ['z'],
  'и': ['i'], 'й': ['y', 'j'], 'к': ['k'], 'л': ['l'], 'м': ['m'],
  'н': ['n', 'h'], 'о': ['o'], 'п': ['p'], 'р': ['r', 'p'], 'с': ['s', 'c'],
  'т': ['t'], 'у': ['u', 'y'], 'ф': ['f'], 'х': ['kh', 'x', 'h'],
  'ц': ['ts', 'c'], 'ч': ['ch'], 'ш': ['sh'], 'щ': ['shch'],
  'ы': ['y'], 'э': ['e'], 'ю': ['yu'], 'я': ['ya'],
};

// ── Simple Latin → Cyrillic (for reverse transliteration) ──
const LAT_TO_CYR: Record<string, string> = {
  'a':'а','b':'б','c':'с','d':'д','e':'е','f':'ф','g':'г','h':'х','i':'и',
  'j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','q':'ку','r':'р',
  's':'с','t':'т','u':'у','v':'в','w':'в','x':'кс','y':'у','z':'з',
};

function switchLayout(str: string, map: Record<string, string>): string {
  return str.split("").map((ch) => map[ch.toLowerCase()] || ch).join("");
}

/** Simple Cyrillic → Latin (single best phonetic match) */
function cyrToLat(str: string): string {
  return str.split("").map((ch) => CYR_MULTI_LAT[ch.toLowerCase()]?.[0] || ch).join("");
}

/** Simple Latin → Cyrillic */
function latToCyr(str: string): string {
  return str.split("").map((ch) => LAT_TO_CYR[ch.toLowerCase()] || ch).join("");
}

/** Generate ALL possible transliterations of a Cyrillic string */
function allCyrToLatVariants(str: string): string[] {
  let results = [""];
  for (const ch of str.toLowerCase()) {
    const lats = CYR_MULTI_LAT[ch] || [ch];
    const next: string[] = [];
    for (const r of results) {
      for (const l of lats) {
        next.push(r + l);
      }
    }
    results = next;
  }
  return results;
}

/** Parse aliases JSON field into a string array */
function parseAliases(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((a: unknown) => typeof a === "string") : [];
  } catch { return []; }
}

export function GlossaryCommand() {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    openGlossaryFn = () => setOpen(true);
    return () => { openGlossaryFn = null; };
  }, []);

  const loadTerms = useCallback(() => {
    setLoading(true);
    fetch("/api/knowledge/glossary")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTerms(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "л" || e.key === "K" || e.key === "Л")) {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) loadTerms();
          else { setSearch(""); setSelectedTerm(null); }
          return next;
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadTerms]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) loadTerms();
    else { setSearch(""); setSelectedTerm(null); }
  }, [loadTerms]);

  // ── Core search filter ──
  const filteredTerms = terms.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();

    // Collect ALL search variants
    const variants = new Set<string>();
    variants.add(q);                                   // original
    variants.add(switchLayout(q, EN_TO_RU));           // keyboard: EN→RU
    variants.add(switchLayout(q, RU_TO_EN));           // keyboard: RU→EN
    variants.add(cyrToLat(q));                         // phonetic: раг→rag
    variants.add(latToCyr(q));                         // reverse: rag→раг

    // All Cyrillic→Latin variants (раг→rag,pag | мсп→msp,mcp)
    for (const v of allCyrToLatVariants(q)) {
      variants.add(v);
    }

    const queries = [...variants].filter(v => v.length > 0);

    const matchesAny = (field: string | null | undefined): boolean => {
      if (!field) return false;
      const fl = field.toLowerCase();
      return queries.some(qv => qv && fl.includes(qv));
    };

    // ONLY search in: term name, shortDefinition, category, aliases
    // Do NOT search in full definition body — that causes false matches like "сдд" finding "One Source of Truth" just because "SDD" appears in the text
    return matchesAny(t.term) || matchesAny(t.shortDefinition) || matchesAny(t.category)
      || parseAliases(t.aliases).some(alias => matchesAny(alias));
  });

  const handleSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 100);
  }, []);

  const handleSelectTerm = useCallback((term: GlossaryTerm) => setSelectedTerm(term), []);

  const handleRelatedTermClick = useCallback(
    (termName: string) => {
      const found = terms.find((t) => t.term.toLowerCase() === termName.toLowerCase());
      if (found) setSelectedTerm(found);
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
    try { return JSON.parse(json); } catch { return []; }
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
        placeholder="Поиск терминов... (RAG, раг, MCP, мсп — найдёт)"
        onValueChange={handleSearch}
      />
      <CommandList>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mx-auto mb-2" />
            Загрузка...
          </div>
        ) : (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}

        {!selectedTerm ? (
          <CommandGroup heading="Термины">
            {filteredTerms.slice(0, 50).map((term) => (
              <CommandItem
                key={term.id}
                onSelect={() => handleSelectTerm(term)}
                className="flex items-start gap-3 py-3 px-3 cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{term.term}</span>
                    {term.category && (
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${categoryColors[term.category] || ""}`}>
                        {term.category}
                      </Badge>
                    )}
                  </div>
                  {term.shortDefinition && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{term.shortDefinition}</p>
                  )}
                  {parseAliases(term.aliases).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {parseAliases(term.aliases).slice(0, 3).map((alias) => (
                        <span key={alias} className="text-[9px] text-muted-foreground/60 bg-white/5 px-1.5 py-0 rounded">{alias}</span>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-1" />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedTerm.term}</h3>
                {selectedTerm.category && (
                  <Badge variant="outline" className={`text-[10px] mt-1 ${categoryColors[selectedTerm.category] || ""}`}>
                    {selectedTerm.category}
                  </Badge>
                )}
                {parseAliases(selectedTerm.aliases).length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {parseAliases(selectedTerm.aliases).map((alias) => (
                      <span key={alias} className="text-[10px] text-muted-foreground/70 bg-white/5 px-1.5 py-0.5 rounded">{alias}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedTerm(null)} className="p-1 rounded-md hover:bg-secondary transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedTerm.definition}</p>
            {selectedTerm.relatedTerms && parseRelatedTerms(selectedTerm.relatedTerms).length > 0 && (
              <>
                <Separator className="bg-white/5" />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Связанные термины</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {parseRelatedTerms(selectedTerm.relatedTerms).map((rt) => {
                      const exists = terms.some((t) => t.term.toLowerCase() === rt.toLowerCase());
                      return exists ? (
                        <button key={rt} onClick={() => handleRelatedTermClick(rt)} className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">{rt}</button>
                      ) : (
                        <span key={rt} className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground">{rt}</span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CommandList>

      {!selectedTerm && (
        <div className="border-t border-white/5 px-4 py-2">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono border border-white/10">Esc</kbd>{" "}
            закрыть • Любая раскладка + транслитерация
          </p>
        </div>
      )}
    </CommandDialog>
  );
}
