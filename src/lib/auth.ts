import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "@/lib/db";

// Check if Google OAuth is properly configured (not placeholder values)
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const isGoogleConfigured =
  googleClientId.length > 30 &&
  googleClientId.includes(".googleusercontent.com") &&
  googleClientSecret.length > 10 &&
  !googleClientSecret.startsWith("placeholder");

// Build providers array — only include Google if properly configured
const providers: NextAuthOptions["providers"] = [];

if (isGoogleConfigured) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
} else {
  console.warn(
    "[Auth] Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET with real values to enable Google login."
  );
}

providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Демо вход",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "admin@ai-trainer.dev" },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;

      const result = await pool.query(
        `SELECT id, email, name, image, role, xp, level, streak FROM users WHERE email = $1`,
        [credentials.email]
      );

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

// Helper: generate CUID-like ID
function genId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export const authOptions: NextAuthOptions = {
  // NO PrismaAdapter — it breaks on Vercel serverless with Neon
  // We handle user creation/linking manually in signIn callback via raw SQL
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // For credentials provider, just allow sign in
      if (account?.provider === "credentials") {
        return true;
      }

      // For Google OAuth — create or link user in DB via raw SQL
      if (account?.provider === "google" && user.email) {
        try {
          // 1. Check if user already exists by email
          const userResult = await pool.query(
            `SELECT id, email, role, xp, level, streak FROM users WHERE email = $1`,
            [user.email]
          );

          let userId: string;

          if (userResult.rows[0]) {
            // User exists — use their ID
            userId = userResult.rows[0].id;

            // Update name/image if Google provided new ones
            if (user.name || user.image) {
              await pool.query(
                `UPDATE users SET name = COALESCE($1, name), image = COALESCE($2, image), "lastActiveAt" = NOW() WHERE id = $3`,
                [user.name, user.image, userId]
              );
            }
          } else {
            // New user — create in DB
            userId = genId();
            await pool.query(
              `INSERT INTO users (id, email, name, image, role, xp, level, streak, "maxStreak", "lastActiveAt") VALUES ($1, $2, $3, $4, 'user', 0, 1, 0, 0, NOW())`,
              [userId, user.email, user.name || null, user.image || null]
            );
          }

          // 2. Create or update Account record (links Google to user)
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

          // 3. Store user ID on the user object for JWT callback
          (user as Record<string, unknown>).dbId = userId;

          console.log("[Auth] Google sign-in successful for:", user.email);
          return true;
        } catch (e) {
          console.error("[Auth] Google sign-in DB error:", e);
          // Still allow sign-in even if DB write fails — JWT will have basic data
          return true;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign in — user object is available
      if (user) {
        // For Google OAuth, we stored dbId in signIn callback
        const dbId = (user as Record<string, unknown>).dbId;
        if (dbId) {
          token.id = dbId;
        } else if (user.id) {
          token.id = user.id;
        }

        // Try to get role/xp/level from user object (credentials provider)
        const role = (user as Record<string, unknown>).role;
        if (role) {
          token.role = role;
          token.xp = (user as Record<string, unknown>).xp || 0;
          token.level = (user as Record<string, unknown>).level || 1;
          token.streak = (user as Record<string, unknown>).streak || 0;
        }
      }

      // For OAuth first login, fetch additional user data from DB
      if (account?.provider === "google" && user?.email) {
        try {
          const result = await pool.query(
            `SELECT id, role, xp, level, streak FROM users WHERE email = $1`,
            [user.email]
          );
          if (result.rows[0]) {
            const dbUser = result.rows[0];
            token.id = dbUser.id;
            token.role = dbUser.role || "user";
            token.xp = dbUser.xp || 0;
            token.level = dbUser.level || 1;
            token.streak = dbUser.streak || 0;
          } else {
            // User might not be in DB yet — set defaults
            token.role = "user";
            token.xp = 0;
            token.level = 1;
            token.streak = 0;
          }
        } catch (e) {
          console.error("[Auth] Failed to fetch user data for Google login:", e);
          token.role = "user";
          token.xp = 0;
          token.level = 1;
          token.streak = 0;
        }
      }

      // Ensure defaults are always set
      if (!token.role) token.role = "user";
      if (!token.xp) token.xp = 0;
      if (!token.level) token.level = 1;
      if (!token.streak) token.streak = 0;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).xp = token.xp;
        (session.user as Record<string, unknown>).level = token.level;
        (session.user as Record<string, unknown>).streak = token.streak;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

// Export flag for UI to know if Google login is available
export { isGoogleConfigured };
