# Task 2-a: Gamification Grade System & Quiz XP

**Status**: Completed

## Summary

Added grade system and quiz XP logic to `src/lib/gamification.ts`. Four new exports added at end of file; all existing functions unchanged.

## New Exports

| Export | Type | Description |
|--------|------|-------------|
| `getGradeName(level)` | function | Russian grade name by level thresholds |
| `getGradeColor(level)` | function | Tailwind color class for grade |
| `xpForQuiz(correctCount, totalCount, difficulty)` | function | Quiz XP with difficulty multiplier & perfect bonus |
| `QUIZ_TIME_PER_QUESTION` | const (30) | Seconds per quiz question |

## Verification
- `tsc --noEmit` — passed
- `bun run lint` — no new errors
