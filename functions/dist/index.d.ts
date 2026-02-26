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
export {};
