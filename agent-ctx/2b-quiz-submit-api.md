# Task 2-b: Quiz Submit API Route

## Summary
Created the API route at `/home/z/my-project/src/app/api/knowledge/quiz/submit/route.ts` for submitting quiz results and awarding XP to users.

## Implementation Details

### Route: POST `/api/knowledge/quiz/submit`

**Request body:**
```json
{
  "articleId": "string",
  "correctCount": 3,
  "totalCount": 5,
  "difficulty": "medium",
  "timeSpent": 120
}
```

**Flow:**
1. Authenticates user via `getServerSession(authOptions)`
2. Validates request body fields (articleId, correctCount, totalCount, difficulty)
3. Checks that article exists and has a quiz attached
4. Calculates XP using `xpForQuiz(correctCount, totalCount, difficulty)` from `@/lib/gamification`
5. Fetches current user XP, computes new total and level via `calculateLevel(newTotalXp)`
6. Updates `users` table: `xp = xp + $1, level = $2, "lastActiveAt" = NOW()`
7. Logs XP gain in `xp_logs` with `genId("xpl_")` for the ID
8. Returns `{ success, xpEarned, totalXp, newLevel, grade }` where grade = `getGradeName(newLevel)`

**Error handling:**
- 401 if not authenticated
- 400 for invalid/missing parameters or article without quiz
- 404 if article or user not found
- 500 for unexpected errors

**Config:** `export const dynamic = "force-dynamic"`

## Files Created
- `/home/z/my-project/src/app/api/knowledge/quiz/submit/route.ts`

## Dependencies Used
- `next-auth` (getServerSession)
- `@/lib/auth` (authOptions)
- `@/lib/db` (pool)
- `@/lib/gamification` (xpForQuiz, calculateLevel, getGradeName)
- `@/lib/gen-id` (genId with "xpl_" prefix)

## Lint Status
✅ No lint errors
