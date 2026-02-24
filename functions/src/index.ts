/**
 * Azure Functions v4 — Timer-triggered live sync.
 *
 * Runs every 2 minutes and calls the web app's /api/cron/sync-live endpoint
 * to sync contests with live or upcoming matches.
 *
 * App Settings required:
 *   - CRON_TARGET_URL: The web app URL (e.g. https://app-xxxx.azurewebsites.net)
 *   - CRON_SECRET: Shared bearer token for authentication
 */

import { app, InvocationContext, Timer } from "@azure/functions";

async function syncLiveTimer(
  _timer: Timer,
  context: InvocationContext,
): Promise<void> {
  const targetUrl = process.env.CRON_TARGET_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!targetUrl) {
    context.error("CRON_TARGET_URL is not configured");
    return;
  }

  const url = `${targetUrl}/api/cron/sync-live`;
  context.log(`Calling ${url} ...`);

  try {
    const headers: Record<string, string> = {};
    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();

    if (!res.ok) {
      context.error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
      return;
    }

    context.log(`Result: ${data.message}`);
    if (data.synced?.length > 0) {
      for (const s of data.synced) {
        if (s.error) {
          context.warn(`  ${s.contestName}: ${s.error}`);
        } else {
          context.log(
            `  ${s.contestName}: ${s.matchesUpserted} matches, ${s.predictionsScored} scored`,
          );
        }
      }
    }
  } catch (error) {
    context.error(
      `Failed to call sync-live: ${error instanceof Error ? error.message : error}`,
    );
  }
}

app.timer("syncLiveTimer", {
  // Every 2 minutes
  schedule: "0 */2 * * * *",
  handler: syncLiveTimer,
});
