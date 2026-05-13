import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy",
    }),
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
    }),
  ],
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
