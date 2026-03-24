import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { prisma } from "./db";

// Auth.js v5 auto-reads AUTH_MICROSOFT_ENTRA_ID_ISSUER from the environment.
// An empty string causes InvalidEndpoints ("missing issuer"). Remove it so
// the explicit fallback in getProviders() takes effect.
if (!process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) {
  delete process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
}

// Extend the session types to include role
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "USER" | "ADMIN";
    };
  }
}

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
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
    providers.push(
      MicrosoftEntraId({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        // Explicitly set issuer: use the env var when non-empty,
        // otherwise fall back to multi-tenant ("common") endpoint.
        // This prevents the provider from reading an empty
        // AUTH_MICROSOFT_ENTRA_ID_ISSUER env var and failing with "Invalid URL".
        issuer:
          process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ||
          "https://login.microsoftonline.com/common/v2.0",
        allowDangerousEmailAccountLinking: true,
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
  events: {
    async createUser({ user }) {
      // Make the very first user an ADMIN automatically
      const userCount = await prisma.user.count();
      if (userCount === 1) {
        await prisma.user.update({
          where: { id: user.id! },
          data: { role: "ADMIN" },
        });
      }
    },
  },
  callbacks: {
    session({ session, user }) {
      // Expose user ID and role on the session object
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: string }).role === "ADMIN" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
});
