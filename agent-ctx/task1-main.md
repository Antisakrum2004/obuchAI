# Task: Implement Visual Progress Tree & Adaptive Difficulty

## Summary

Both features have been implemented/verified.

### Feature 1: Visual Progress Tree (Skill Map) ✅

**Files modified:**
- `/src/components/skills/skill-tree.tsx` — Completely redesigned with grid-based layout
- `/src/app/skills/page.tsx` — Updated loading skeleton to match grid layout

**What was done:**
- Replaced the old tab-based tree layout with a responsive grid layout
- Categories display as column headers (sorted: Промптинг, Агенты, Дебаг, Workflow, 1С, Ревью)
- Skills rendered as cards under their category with 3 status styles:
  - **Completed**: bright emerald border-2, star badge, emerald progress bar
  - **In-progress**: amber border-2, amber progress bar
  - **Locked (0 xp)**: gray dashed border-2, lock icon overlay, muted/grayscale
- Vertical CSS connector lines between skills in same category (using `bg-{color}/25` divs)
- Framer Motion stagger animation (category headers stagger at 0.08s, cards at 0.06s within each category)
- Click on a skill → Radix Popover with challenge count, description, XP info, and "Start" link
- Responsive: 1 column on mobile, 2 on sm, 3 on lg
- Kept the SkillDetailPanel (bottom sheet) for mobile accessibility

**API route `/api/skills/route.ts`** was already returning all needed data:
- All skills with category, icon, requiredXp, description
- User's progress per skill (xp, level)
- Challenge count per skill

### Feature 2: Adaptive Difficulty ✅ (Already implemented)

All components were already in place:

1. **`/src/app/api/admin/migrate/route.ts`** — Already has `consecutiveCorrect` and `consecutiveWrong` columns in ALTER statements
2. **`/src/app/api/challenges/route.ts`** — Already reads consecutiveCorrect/consecutiveWrong and applies adaptive sorting (hard first when >=5 correct, easy first when >=3 wrong). Returns `difficultyBoost` field.
3. **`/src/app/api/challenges/[id]/submit/route.ts`** — Already updates counters: correct → `consecutiveCorrect + 1, consecutiveWrong = 0`; wrong → `consecutiveWrong + 1, consecutiveCorrect = 0`
4. **`/src/app/challenges/page.tsx`** — Already shows adaptive badge: `🔥 Разогрев` when `difficultyBoost === "harder"` and `🛡️ Поддержка` when `difficultyBoost === "easier"`

## Lint Result
- 0 errors, 3 warnings (all pre-existing in unrelated files)
- No type errors in the modified files
