# Marathon Mode Implementation - Task Summary

## Task: Implement Marathon Mode in Next.js project

## What was built:

### 1. API Endpoint: GET /api/marathon (`/src/app/api/marathon/route.ts`)
- Returns 15 random active challenges, mixed difficulties
- Prioritizes unsolved challenges for the user
- Orders by difficulty (easy → medium → hard)
- Returns `{ challenges: [...], marathonId: string }`
- Requires auth (session check)

### 2. API Endpoint: POST /api/marathon/complete (`/src/app/api/marathon/complete/route.ts`)
- Accepts `{ correctCount, totalAttempts, longestStreak }`
- Calculates bonus XP: base XP × streak multiplier
- Multiplier tiers: 5+ streak = ×1.5, 10+ = ×2, 15+ = ×3
- Updates user XP in DB via pool.query
- Returns `{ xpEarned, multiplier, accuracy, newLevel }`

### 3. Marathon Page (`/src/app/marathon/page.tsx`)
- Three states: "start", "playing", "gameover"
- **Start screen**: "Марафон" title with Flame icon, rule cards (3 lives, no cooldowns, streak multiplier), "Начать марафон" button with btn-bounce class
- **Playing state**: Shows one challenge at a time
  - Progress bar with position indicator (e.g. "7/15")
  - 3 hearts at top, lose one per wrong answer
  - Current multiplier display (×1.0 → ×1.5 → ×2.0 → ×3.0) with color coding
  - Timer showing elapsed time
  - Reuses MultipleChoice and OrderingChallenge components
  - On correct: green flash, animate to next
  - On wrong: red flash, lose heart, show explanation briefly, then next
  - No cooldowns
  - Local answer validation (no API call during marathon)
  - Uses refs for stats to avoid stale closure bugs in setTimeout callbacks
- **Game over screen**: Stats card, XP earned with multiplier, retry/challenges buttons
- Uses `<AppLayout>` wrapper
- Framer Motion for transitions
- Mobile-friendly

### 4. Navigation Integration
- **Sidebar** (`/src/components/layout/app-sidebar.tsx`): Added "Марафон" nav item after Challenges with Flame icon, href="/marathon"
- **Mobile Tab Bar** (`/src/components/layout/mobile-tab-bar.tsx`): Replaced Playground tab with Marathon tab (Flame icon)
- **Dashboard** (`/src/app/dashboard/page.tsx`): Added "Марафон" entry card after the daily challenge widget with orange gradient styling

## Key Design Decisions:
- Used refs for `correctCount`, `longestStreak`, `totalAttempts` to avoid stale closure issues when reading values in setTimeout callbacks
- Local answer validation in marathon mode (no API submit per question) for speed
- Marathon completion stats submitted once at the end via POST /api/marathon/complete
- XP calculation uses average base XP per correct answer (40 XP) since individual challenge difficulty varies

## Lint Status: ✅ No errors (only 3 pre-existing warnings in other files)
