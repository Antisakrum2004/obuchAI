import "next-auth";
import "next-auth/jwt";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    xp?: number;
    level?: number;
    streak?: number;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
      xp?: number;
      level?: number;
      streak?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    xp?: number;
    level?: number;
    streak?: number;
  }
}
