import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Detect Azure environment.
 * When AZURE_POSTGRESQL_HOST is set, we use managed identity authentication.
 * Otherwise, fall back to DATABASE_URL with password-based auth (local dev).
 */
const isAzure = !!process.env.AZURE_POSTGRESQL_HOST;

async function getAzureAccessToken(): Promise<string> {
  // Dynamic import to avoid loading @azure/identity in local dev
  const { DefaultAzureCredential } = await import("@azure/identity");
  const credential = new DefaultAzureCredential();
  // The scope for Azure Database for PostgreSQL
  const token = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default");
  return token.token;
}

function createPrismaClient(): PrismaClient {
  if (isAzure) {
    // Azure: use managed identity — pg.Pool with token-based auth
    const pool = new pg.Pool({
      host: process.env.AZURE_POSTGRESQL_HOST,
      port: 5432,
      database: process.env.AZURE_POSTGRESQL_DATABASE ?? "sport_predictor",
      user: process.env.AZURE_POSTGRESQL_USER, // managed identity name
      ssl: { rejectUnauthorized: true },
      // pg calls password() before each connection — fetch fresh token each time
      password: async () => getAzureAccessToken(),
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // Local dev: use DATABASE_URL with password
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
