import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "@/lib/db";
import { processReferralReward, getReferrerIdFromCookie } from "@/lib/referral";

// Check if Google OAuth is properly configured
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const isGoogleConfigured =
  googleClientId.length > 30 &&
  googleClientId.includes(".googleusercontent.com") &&
  googleClientSecret.length > 10 &&
  !googleClientSecret.startsWith("placeholder");

// Build providers array
const providers: NextAuthOptions["providers"] = [];

if (isGoogleConfigured) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    })
  );
} else {
  console.warn("[Auth] Google OAuth not configured.");
}

// Demo login — for quick access as regular user (NOT admin)
providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Демо вход",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "demo@ai-trainer.dev" },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;

      let result = await pool.query(
        `SELECT id, email, name, image, role, xp, level, streak FROM users WHERE email = $1`,
        [credentials.email]
      );

      // Auto-create demo user if not exists
      if (!result.rows[0] && credentials.email === "demo@ai-trainer.dev") {
        const id = genId();

        // Check for referral code from cookie
        const referredById = await getReferrerIdFromCookie();

        await pool.query(
          `INSERT INTO users (id, email, name, role, xp, level, streak, "maxStreak", "lastActiveAt", "referredBy") VALUES ($1, $2, $3, 'user', 0, 1, 0, 0, NOW(), $4)`,
          [id, "demo@ai-trainer.dev", "Демо-пользователь", referredById]
        );

        // Process referral rewards
        if (referredById) {
          await processReferralReward(id, referredById);
        }

        result = await pool.query(
          `SELECT id, email, name, image, role, xp, level, streak FROM users WHERE email = $1`,
          [credentials.email]
        );
      }

      const user = result.rows[0];
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        xp: user.xp,
        level: user.level,
        streak: user.streak,
      };
    },
  })
);

// Admin login — separate credentials provider with login/password
providers.push(
  CredentialsProvider({
    id: "admin-credentials",
    name: "Админ вход",
    credentials: {
      username: { label: "Логин", type: "text", placeholder: "admin" },
      password: { label: "Пароль", type: "password" },
    },
    async authorize(credentials) {
      // Admin credentials from env vars ONLY — no hardcoded fallbacks
      const ADMIN_USER = process.env.ADMIN_USERNAME;
      const ADMIN_PASS = process.env.ADMIN_PASSWORD;

      if (!ADMIN_USER || !ADMIN_PASS) {
        console.error("[Auth] ADMIN_USERNAME / ADMIN_PASSWORD env vars not set — admin login disabled");
        return null;
      }

      if (
        credentials?.username !== ADMIN_USER ||
        credentials?.password !== ADMIN_PASS
      ) {
        return null;
      }

      // Find admin user in DB
      const result = await pool.query(
        `SELECT id, email, name, image, role, xp, level, streak FROM users WHERE email = $1 AND role = 'admin'`,
        ["admin@ai-trainer.dev"]
      );

      const user = result.rows[0];
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name || "Администратор",
        image: user.image,
        role: "admin",
        xp: user.xp,
        level: user.level,
        streak: user.streak,
      };
    },
  })
);

// Helper: generate CUID-like ID
function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — explicit so sessions don't silently expire
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days — keep in sync with session maxAge
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials" || account?.provider === "admin-credentials") {
        return true;
      }

      if (account?.provider === "google" && user.email) {
        try {
          // Find or create user in DB
          const userResult = await pool.query(
            `SELECT id, email, role, xp, level, streak FROM users WHERE email = $1`,
            [user.email]
          );

          let userId: string;

          if (userResult.rows[0]) {
            userId = userResult.rows[0].id;
            // Update name/image from Google
            if (user.name || user.image) {
              await pool.query(
                `UPDATE users SET name = COALESCE($1, name), image = COALESCE($2, image), "lastActiveAt" = NOW() WHERE id = $3`,
                [user.name, user.image, userId]
              );
            }
          } else {
            // New user — check for referral code from cookie
            const referredById = await getReferrerIdFromCookie();

            userId = genId();
            await pool.query(
              `INSERT INTO users (id, email, name, image, role, xp, level, streak, "maxStreak", "lastActiveAt", "referredBy") VALUES ($1, $2, $3, $4, 'user', 0, 1, 0, 0, NOW(), $5)`,
              [userId, user.email, user.name || null, user.image || null, referredById]
            );

            // Process referral rewards
            if (referredById) {
              await processReferralReward(userId, referredById);
            }
          }

          // CRITICAL: Override user.id with our DB user ID
          user.id = userId;

          // Store user data on user object for JWT callback
          user.role = userResult.rows[0]?.role || "user";
          user.xp = userResult.rows[0]?.xp || 0;
          user.level = userResult.rows[0]?.level || 1;
          user.streak = userResult.rows[0]?.streak || 0;

          // Upsert account record
          try {
            await pool.query(
              `INSERT INTO accounts (id, "userId", type, provider, "providerAccountId", "access_token", "refresh_token", "expires_at", "token_type", scope, "id_token", "session_state")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (provider, "providerAccountId") DO UPDATE SET
                 "access_token" = EXCLUDED."access_token",
                 "refresh_token" = EXCLUDED."refresh_token",
                 "expires_at" = EXCLUDED."expires_at",
                 "id_token" = EXCLUDED."id_token",
                 "session_state" = EXCLUDED."session_state"`,
              [
                genId(),
                userId,
                account.type,
                account.provider,
                account.providerAccountId,
                account.access_token || null,
                account.refresh_token || null,
                account.expires_at || null,
                account.token_type || null,
                account.scope || null,
                account.id_token || null,
                account.session_state || null,
              ]
            );
          } catch (accErr) {
            console.error("[Auth] Account upsert failed (non-critical):", accErr);
          }

          console.log("[Auth] Google sign-in OK:", user.email, "userId:", userId);
          return true;
        } catch (e) {
          console.error("[Auth] Google sign-in error:", e);
          return true;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // On initial sign-in, user object is available
      if (user) {
        token.id = user.id;
        // Copy custom fields from user (set in signIn callback for Google)
        const role = user.role;
        if (role) {
          token.role = role;
          token.xp = user.xp || 0;
          token.level = user.level || 1;
          token.streak = user.streak || 0;
        } else {
          // Fallback: fetch from DB if not set
          if (user.email) {
            try {
              const result = await pool.query(
                `SELECT id, role, xp, level, streak FROM users WHERE email = $1`,
                [user.email]
              );
              if (result.rows[0]) {
                token.id = result.rows[0].id;
                token.role = result.rows[0].role || "user";
                token.xp = result.rows[0].xp || 0;
                token.level = result.rows[0].level || 1;
                token.streak = result.rows[0].streak || 0;
              }
            } catch {
              // Ignore DB errors
            }
          }
        }
      } else if (token.id) {
        // Subsequent requests (user is NOT set) — refresh user data from DB
        // so the JWT stays fresh even if the user's role/xp/level/streak changed
        try {
          const result = await pool.query(
            `SELECT role, xp, level, streak FROM users WHERE id = $1`,
            [token.id]
          );
          if (result.rows[0]) {
            token.role = result.rows[0].role || "user";
            token.xp = result.rows[0].xp || 0;
            token.level = result.rows[0].level || 1;
            token.streak = result.rows[0].streak || 0;
          }
        } catch {
          // DB unavailable — keep existing token values (graceful degradation)
        }
      }

      // Ensure defaults
      if (!token.role) token.role = "user";
      if (token.xp === undefined) token.xp = 0;
      if (!token.level) token.level = 1;
      if (token.streak === undefined) token.streak = 0;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.xp = token.xp;
        session.user.level = token.level;
        session.user.streak = token.streak;
      }
      return session;
    },

    // Explicit redirect callback to prevent redirect loops
    async redirect({ url, baseUrl }) {
      // If url is relative, prepend baseUrl
      if (url.startsWith("/")) return baseUrl + url;
      // If url is on same domain, allow it
      if (new URL(url).origin === baseUrl) return url;
      // Default redirect to dashboard after sign-in
      return baseUrl + "/dashboard";
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

export { isGoogleConfigured };
