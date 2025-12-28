import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import db from "./db/db";
import { usersTable } from "./db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logEvent } from "./analytics/logs";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      const start = performance.now();

      const existing = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, user.email!));

      let isNewUser = false;
      let uid = existing[0]?.id;

      if (!uid) {
        isNewUser = true;
        uid = randomUUID();

        await db.insert(usersTable).values({
          id: uid,
          name: user.name ?? "",
          email: user.email!,
          image: user.image,
        });
      }

      (user as { id: string }).id = uid;

      void logEvent({
        event: isNewUser ? "user_signup" : "user_login",
        userEmail: user.email!,
        success: true,
        metadata: {
          latency_ms: Math.round(performance.now() - start),
          provider: "github",
          isNewUser,
        },
      });

      return true;
    },

    async jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },

    async session({ session, token }) {
      (session.user as { id: string }).id = token.id as string;
      return session;
    },
  },

  events: {
    async signOut(message) {
      void logEvent({
        event: "user_logout",
        userEmail: message?.token?.email ?? "unknown",
        success: true,
        metadata: {},
      });
    }
  },
};