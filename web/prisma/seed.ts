/**
 * Seed script — syncs all supported competitions from API-Football.
 *
 * Usage:
 *   npx tsx prisma/seed.ts
 *
 * Requires:
 *   - FOOTBALL_API_KEY environment variable set
 *   - DATABASE_URL environment variable set
 *   - Database migrated (npx prisma migrate dev)
 */

import "dotenv/config";
import { syncAll } from "../src/lib/sync";

async function main() {
  console.log("🌱 Seeding database from API-Football...\n");

  const results = await syncAll();

  console.log("\n📊 Seed summary:");
  for (const r of results) {
    console.log(`   Contest ${r.contestId}: ${r.teamsUpserted} teams, ${r.matchesUpserted} matches`);
  }

  console.log("\n✅ Seed complete.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
