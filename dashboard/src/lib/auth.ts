import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";
import { usersTable } from "./schema";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email read:org",
        },
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email:
            profile.email ??
            `${profile.login}@users.noreply.github.com`,
          image: profile.avatar_url,
          login: profile.login,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      const email = user.email!;
      const existing = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));

      let uid = existing[0]?.id;

      if (!uid) {
        uid = randomUUID();
        await db.insert(usersTable).values({
          id: uid,
          name: user.name ?? "",
          email,
          image: user.image,
        });
      }

      (user as any).id = uid;
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id;
        token.login = (user as any).login;
      }

      if (account?.access_token) {
        token.githubAccessToken = account.access_token;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).login = token.login;
        (session.user as any).githubAccessToken = token.githubAccessToken;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};