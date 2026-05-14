import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

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

      // Direct DB query via raw SQL to avoid Prisma adapter issues
      const { pool } = await import("@/lib/db");
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // For credentials provider, just allow sign in
      if (account?.provider === "credentials") {
        return true;
      }
      // For OAuth providers (Google), allow sign in
      return true;
    },
    async jwt({ token, user, account }) {
      // Initial sign in - user object is available
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role || "user";
        token.xp = (user as Record<string, unknown>).xp || 0;
        token.level = (user as Record<string, unknown>).level || 1;
        token.streak = (user as Record<string, unknown>).streak || 0;
      }
      // For OAuth first login, fetch additional user data from DB
      if (account?.provider === "google" && user?.email) {
        try {
          const { pool } = await import("@/lib/db");
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
          }
        } catch (e) {
          console.error("Failed to fetch user data for Google login:", e);
        }
      }
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
