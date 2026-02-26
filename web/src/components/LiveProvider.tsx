"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveMatch {
  id: string;
  externalId: number | null;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  kickoffTime: string;
  matchDay: number | null;
  stage: string | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    crest: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    crest: string | null;
  };
  contestId: string;
}

interface LiveContextValue {
  /** Map of match ID → latest live data */
  liveMatches: Map<string, LiveMatch>;
  /** Whether the SSE connection is active */
  connected: boolean;
  /** Counter that increments when predictions are scored (use to trigger refetch) */
  scoresVersion: number;
}

const LiveContext = createContext<LiveContextValue>({
  liveMatches: new Map(),
  connected: false,
  scoresVersion: 0,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LiveProvider({
  contestIds,
  children,
}: {
  contestIds: string[];
  children: React.ReactNode;
}) {
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());
  const [connected, setConnected] = useState(false);
  const [scoresVersion, setScoresVersion] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    // Don't connect if no contest IDs provided
    if (contestIds.length === 0) return;

    const params = new URLSearchParams();
    params.set("contestIds", contestIds.join(","));
    const url = `/api/live/stream?${params.toString()}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.addEventListener("match-update", (event) => {
      try {
        const match: LiveMatch = JSON.parse(event.data);
        setLiveMatches((prev) => {
          const next = new Map(prev);
          next.set(match.id, match);
          return next;
        });
      } catch (err) {
        console.error("[LiveProvider] Failed to parse match-update:", err);
      }
    });

    es.addEventListener("scores-updated", () => {
      setScoresVersion((v) => v + 1);
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current();
      }, 5000);
    };
  }, [contestIds]);

  // Keep the ref in sync so reconnection always uses the latest connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return (
    <LiveContext.Provider value={{ liveMatches, connected, scoresVersion }}>
      {children}
    </LiveContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the live matches context.
 */
export function useLive(): LiveContextValue {
  return useContext(LiveContext);
}

/**
 * Get live data for a specific match by ID, or null if it's not live.
 */
export function useLiveMatch(matchId: string): LiveMatch | null {
  const { liveMatches } = useLive();
  return liveMatches.get(matchId) ?? null;
}

/**
 * Get all currently live matches (IN_PLAY or PAUSED).
 */
export function useLiveMatchesList(): LiveMatch[] {
  const { liveMatches } = useLive();
  return Array.from(liveMatches.values()).filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  );
}

/**
 * Returns a counter that increments whenever predictions are scored.
 * Use this to trigger refetches of standings/results data.
 */
export function useScoresVersion(): number {
  const { scoresVersion } = useLive();
  return scoresVersion;
}
