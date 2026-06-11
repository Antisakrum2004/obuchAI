# Task 3-a: Update QuizBlock with Timer, XP, and API Submission

## Summary
Enhanced the QuizBlock component in the learn page with countdown timer, auto-advance, XP calculation, and quiz result API submission.

## Changes Made
**File**: `/home/z/my-project/src/app/knowledge/[spaceId]/learn/[articleId]/page.tsx`

### Imports Added
- `Timer` icon from `lucide-react`
- `xpForQuiz`, `QUIZ_TIME_PER_QUESTION` from `@/lib/gamification`
- `useUserStore` from `@/store/user-store`

### QuizBlock Component Overhaul
1. **New props**: `articleId: string`, `difficulty: string | null`
2. **New state**: `currentQuestion`, `timeLeft`, `xpEarned`, `isSubmitting`
3. **Timer useEffect**: Counts down from `QUIZ_TIME_PER_QUESTION` (30s), auto-advances to next question on timeout, auto-checks on last question timeout
4. **XP calculation**: Uses `xpForQuiz()` when checking answers
5. **API submission**: POST to `/api/knowledge/quiz/submit` with articleId, correctCount, totalCount, difficulty, timeSpent; updates user store with returned XP/level
6. **Single-question UI**: Shows one question at a time with animated transitions
7. **Timer display**: Color-coded timer text + progress bar (green/amber/red)
8. **Navigation**: "Следующий вопрос" / "Проверить ответы" buttons + dot navigation
9. **Results**: Shows `+{xpEarned} XP за квиз!` after checking

### Parent Component Update
- Added `articleId={articleId}` and `difficulty={article.difficulty}` props to QuizBlock invocation

## Lint
No errors in modified file. All pre-existing errors are in other files.

## Dependencies
- Task 2-b created the `/api/knowledge/quiz/submit` API route
- `@/lib/gamification` provides `xpForQuiz` and `QUIZ_TIME_PER_QUESTION`
- `@/store/user-store` provides `useUserStore` for client-side XP/level updates
