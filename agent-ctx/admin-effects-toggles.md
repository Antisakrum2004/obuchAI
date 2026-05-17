# Task: Admin Toggle Controls for Visual Effects

## Summary
Added admin toggle controls for all 8 visual effects in the Next.js project. Admins can now enable/disable effects from the admin panel, and changes propagate to all users within 60 seconds.

## Files Created
1. **`/src/app/api/admin/settings/route.ts`** — Admin API for GET/PUT settings (uses `pool` from `@/lib/db`)
2. **`/src/app/api/settings/route.ts`** — Public settings API (no auth, revalidates every 30s, returns defaults on error)
3. **`/src/hooks/use-app-settings.tsx`** — React context + hook (`useAppSettings`) that fetches settings from public API every 60s and provides boolean getters for all 8 effects

## Files Modified
1. **`/src/app/api/admin/migrate/route.ts`** — Added `app_settings` table creation + default seed data
2. **`/src/app/admin/page.tsx`** — Added "Эффекты" tab with toggle cards for all 8 settings
3. **`/src/app/layout.tsx`** — Wrapped content with `AppSettingsProvider`
4. **`/src/components/effects/particles-background.tsx`** — Returns `null` when `particles` is off
5. **`/src/components/gamification/achievement-unlock-modal.tsx`** — Skips confetti when `confetti` is off
6. **`/src/components/gamification/xp-bar.tsx`** — Renders simple bar when `liquidXp` is off
7. **`/src/components/gamification/hearts-display.tsx`** — Disables animations when `heartAnimations` is off
8. **`/src/components/gamification/streak-counter.tsx`** — Disables fire effect when `streakFire` is off
9. **`/src/components/gamification/avatar-frame.tsx`** — Renders simple circle when `avatarFrames` is off
10. **`/src/app/globals.css`** — Added CSS rules for `[data-micro-animations="off"]` and `[data-adaptive-difficulty="off"]`

## Settings Keys
| Key | Emoji | Name | Description |
|-----|-------|------|-------------|
| particles | ✨ | Частицы фона | Background floating particles |
| confetti | 🎊 | Конфетти | Confetti on achievements |
| liquid_xp | 🌊 | Жидкий XP-бар | Liquid XP bar animation |
| heart_animations | 💔 | Анимация сердец | Heart loss/restore animations |
| streak_fire | 🔥 | Огонь стрика | Fire effect on streak |
| avatar_frames | 👑 | Рамки аватаров | Decorative avatar frames |
| micro_animations | 💫 | Микроанимации | Button/card micro-animations |
| adaptive_difficulty | 🎯 | Адаптивная сложность | Auto difficulty adjustment |

## Architecture
- **DB**: `app_settings` table with `key` (PK), `value`, `updatedAt`
- **Admin API**: GET/PUT at `/api/admin/settings`
- **Public API**: GET at `/api/settings` (cached, no auth)
- **Client**: `AppSettingsProvider` context fetches every 60s, provides `useAppSettings()` hook
- **CSS hooks**: `data-micro-animations` and `data-adaptive-difficulty` attributes on `<html>`
