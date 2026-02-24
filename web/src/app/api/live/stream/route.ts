/**
 * GET /api/live/stream
 *
 * Server-Sent Events (SSE) endpoint that pushes live match updates to clients.
 *
 * The server polls the database every 10 seconds for matches that have been
 * updated since the client's last event, and pushes typed events:
 *
 *   - match-update: score or status changed on a match
 *   - scores-updated: predictions were scored (leaderboard changed)
 *
 * Query params:
 *   - contestIds: comma-separated contest IDs to subscribe to
 *
 * A heartbeat comment is sent every 30 seconds to keep the connection alive.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contestIdsParam = searchParams.get("contestIds");
  const contestIds = contestIdsParam
    ? contestIdsParam.split(",").filter(Boolean)
    : [];

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Track when matches were last updated so we only send deltas
      const lastKnownScores = new Map<
        string,
        {
          status: string;
          homeGoals: number | null;
          awayGoals: number | null;
          updatedAt: string;
        }
      >();

      let lastScoredCheck = new Date();

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      }

      function sendHeartbeat() {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
        }
      }

      // Initial heartbeat
      sendHeartbeat();

      const pollTimer = setInterval(async () => {
        if (closed) {
          clearInterval(pollTimer);
          clearInterval(heartbeatTimer);
          return;
        }

        try {
          // Build query filter
          const where: Record<string, unknown> = {
            status: { in: ["IN_PLAY", "PAUSED", "FINISHED"] },
          };
          if (contestIds.length > 0) {
            where.contestId = { in: contestIds };
          }

          // Fetch matches that are live, paused, or recently finished
          const matches = await prisma.match.findMany({
            where,
            select: {
              id: true,
              externalId: true,
              status: true,
              homeGoals: true,
              awayGoals: true,
              kickoffTime: true,
              matchDay: true,
              stage: true,
              updatedAt: true,
              homeTeam: {
                select: { id: true, name: true, shortName: true, crest: true },
              },
              awayTeam: {
                select: { id: true, name: true, shortName: true, crest: true },
              },
              contestId: true,
            },
            orderBy: { kickoffTime: "asc" },
          });

          // Detect changes and push updates
          for (const match of matches) {
            const prev = lastKnownScores.get(match.id);
            const changed =
              !prev ||
              prev.status !== match.status ||
              prev.homeGoals !== match.homeGoals ||
              prev.awayGoals !== match.awayGoals;

            if (changed) {
              send("match-update", {
                id: match.id,
                externalId: match.externalId,
                status: match.status,
                homeGoals: match.homeGoals,
                awayGoals: match.awayGoals,
                kickoffTime: match.kickoffTime,
                matchDay: match.matchDay,
                stage: match.stage,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                contestId: match.contestId,
              });

              lastKnownScores.set(match.id, {
                status: match.status,
                homeGoals: match.homeGoals,
                awayGoals: match.awayGoals,
                updatedAt: match.updatedAt.toISOString(),
              });
            }
          }

          // Check if any predictions were scored since our last check
          const contestFilter =
            contestIds.length > 0
              ? { group: { contestId: { in: contestIds } } }
              : {};

          const recentlyScored = await prisma.prediction.count({
            where: {
              ...contestFilter,
              pointsAwarded: { not: null },
              updatedAt: { gt: lastScoredCheck },
            },
          });

          if (recentlyScored > 0) {
            send("scores-updated", {
              count: recentlyScored,
              timestamp: new Date().toISOString(),
            });
          }

          lastScoredCheck = new Date();
        } catch (err) {
          console.error("[SSE] Poll error:", err);
        }
      }, POLL_INTERVAL_MS);

      const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
