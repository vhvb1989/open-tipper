import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { prisma } from "./db";

/**
 * NextAuth.js (Auth.js v5) configuration.
 *
 * Providers are enabled dynamically — only those with env vars set will appear.
 * This means deployers can choose any combination of Google, GitHub, and
 * Microsoft without code changes.
 */
function getProviders() {
  const providers = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }

  if (
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  ) {
    providers.push(
      MicrosoftEntraId({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        // issuer defaults to AUTH_MICROSOFT_ENTRA_ID_ISSUER env var,
        // or "common" (multi-tenant) if not set
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: getProviders(),
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    session({ session, user }) {
      // Expose the user ID on the session object
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
