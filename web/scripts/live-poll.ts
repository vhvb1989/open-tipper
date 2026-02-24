#!/usr/bin/env tsx
/**
 * Localhost live-polling script.
 *
 * Calls the /api/cron/sync-live endpoint at a configurable interval
 * to simulate the Azure Functions timer trigger during local development.
 *
 * Usage:
 *   npx tsx scripts/live-poll.ts
 *
 * Environment:
 *   POLL_INTERVAL_SECONDS — polling interval in seconds (default: 90)
 *   CRON_SECRET          — bearer token for the cron endpoint (optional in dev)
 *   BASE_URL             — Next.js server URL (default: http://localhost:3000)
 */

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_SECONDS ?? "90", 10) * 1000;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function poll() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] Polling ${BASE_URL}/api/cron/sync-live ...`);

  try {
    const headers: Record<string, string> = {};
    if (CRON_SECRET) {
      headers["Authorization"] = `Bearer ${CRON_SECRET}`;
    }

    const res = await fetch(`${BASE_URL}/api/cron/sync-live`, { headers });
    const data = await res.json();

    if (!res.ok) {
      console.error(`  ✗ HTTP ${res.status}:`, data);
      return;
    }

    console.log(`  ✓ ${data.message}`);
    if (data.synced?.length > 0) {
      for (const s of data.synced) {
        if (s.error) {
          console.log(`    ✗ ${s.contestName}: ${s.error}`);
        } else {
          console.log(
            `    ✓ ${s.contestName}: ${s.matchesUpserted} matches, ${s.predictionsScored} predictions scored`,
          );
        }
      }
    }
  } catch (error) {
    console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error);
  }
}

// Initial poll
poll();

// Schedule recurring polls
const timer = setInterval(poll, POLL_INTERVAL);

console.log(`🔄 Live polling started (every ${POLL_INTERVAL / 1000}s)`);
console.log(`   Target: ${BASE_URL}/api/cron/sync-live`);
console.log(`   Press Ctrl+C to stop\n`);

// Graceful shutdown
process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\n🛑 Polling stopped");
  process.exit(0);
});
