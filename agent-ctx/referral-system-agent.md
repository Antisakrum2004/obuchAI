# Referral System Implementation Summary

## Task: Implement a referral system in the Next.js project

## Files Modified

### 1. `/src/app/api/admin/migrate/route.ts`
- Added 3 new ALTER TABLE statements to the `alterStatements` array:
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE;`
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy" TEXT;`
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCount" INTEGER DEFAULT 0;`

### 2. `/src/app/api/user/stats/route.ts`
- Extended the SELECT query to include `referralCode`, `referralCount`, `referredBy` columns
- Added auto-generation logic: when a user has no `referralCode`, generates one from email prefix + 4 random chars
- Includes retry logic for unique constraint collisions
- Added `referralCode`, `referralCount`, `referredBy` to the response JSON

### 3. `/src/lib/auth.ts`
- Added `import { cookies } from "next/headers"` for reading referral cookie
- **Demo authorize function**: When creating a new demo user, reads `ref` cookie, looks up referrer by code, sets `referredBy`, increments referrer's `referralCount`, awards +50 XP to both users, logs XP entries
- **Google sign-in callback**: When creating a new Google user, same referral logic — reads `ref` cookie, processes referral rewards

### 4. `/src/app/api/referral/route.ts` (NEW)
- **GET**: Returns current user's referral info (code, count, referredBy, xpFromReferrals). Auto-generates code if missing.
- **POST**: Accepts `{ code: string }` to apply a referral code. Uses transaction for atomicity. Validates: user doesn't already have a referrer, code exists, not self-referring. Awards +50 XP to both users.

### 5. `/src/components/profile/referral-card.tsx` (NEW)
- Full-featured referral card component with two modes:
  - **Default (full)**: Shows referral code, copy link button, share button (Web Share API with copy fallback), referral stats (count + XP), referral URL display, and an input to apply someone else's code
  - **Compact**: Minimal version for dashboard with code, copy button, and stats
- Glass card styling matching the app's design system
- Framer Motion animations
- Toast notifications for user feedback

### 6. `/src/app/profile/[id]/page.tsx`
- Added `ReferralCard` import and `useUserStore` import
- Added `isOwnProfile` check (currentUserId === profile id)
- Renders `<ReferralCard />` below the profile header, only visible on own profile

### 7. `/src/app/dashboard/page.tsx`
- Added `ReferralCard` import
- Added compact `<ReferralCard compact />` widget in the bottom section after the grid

### 8. `/src/app/login/page.tsx`
- Added `useSearchParams` import
- Reads `ref` URL parameter and stores it in a cookie (`ref=CODE; path=/; max-age=7d; SameSite=Lax`)
- The cookie persists through the OAuth flow so the auth callback can read it

## Key Design Decisions
- Referral codes format: `{email_prefix}-{4_random_chars}` (e.g., `demo-a3x7`)
- Both referrer and referee get +50 XP
- XP rewards are logged in `xp_logs` table for auditability
- Transaction used in POST `/api/referral` for data consistency
- Cookie-based referral tracking to survive OAuth redirects
- Self-referral prevention
