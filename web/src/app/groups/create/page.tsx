"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Contest {
  id: string;
  name: string;
  code: string;
  season: string;
}

interface ScoringRulesForm {
  exactScore: number;
  goalDifference: number;
  outcome: number;
  oneTeamGoals: number;
  totalGoals: number;
  reverseGoalDifference: number;
  accumulationMode: "ACCUMULATE" | "HIGHEST_ONLY";
  playoffMultiplier: boolean;
}

const DEFAULT_SCORING: ScoringRulesForm = {
  exactScore: 10,
  goalDifference: 6,
  outcome: 4,
  oneTeamGoals: 3,
  totalGoals: 2,
  reverseGoalDifference: 1,
  accumulationMode: "ACCUMULATE",
  playoffMultiplier: false,
};

export default function CreateGroupPage() {
  const { status } = useSession();
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contestId, setContestId] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [scoring, setScoring] = useState<ScoringRulesForm>(DEFAULT_SCORING);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  // Fetch contests
  useEffect(() => {
    fetch("/api/contests")
      .then((res) => res.json())
      .then((data) => {
        setContests(data.contests ?? []);
        if (data.contests?.length > 0) {
          setContestId(data.contests[0].id);
        }
      })
      .catch(() => setError("Failed to load contests"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          contestId,
          visibility,
          scoringRules: scoring,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create group");
      }

      const data = await res.json();
      router.push(`/groups/${data.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Create a Group
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Set up a prediction group for a football competition.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Group Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Group name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Office Champions League"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Contest */}
        <div>
          <label htmlFor="contestId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Competition <span className="text-red-500">*</span>
          </label>
          <select
            id="contestId"
            required
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.season})
              </option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Visibility
          </label>
          <div className="mt-2 flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="visibility"
                value="PRIVATE"
                checked={visibility === "PRIVATE"}
                onChange={() => setVisibility("PRIVATE")}
                className="text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Private — invite only
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="visibility"
                value="PUBLIC"
                checked={visibility === "PUBLIC"}
                onChange={() => setVisibility("PUBLIC")}
                className="text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Public — anyone can join
              </span>
            </label>
          </div>
        </div>

        {/* Scoring Rules (Advanced) */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            <span>Scoring Rules</span>
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Customize how points are awarded. Defaults match the standard scoring system.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {([
                  ["exactScore", "Exact score"],
                  ["goalDifference", "Goal difference"],
                  ["outcome", "Correct outcome"],
                  ["oneTeamGoals", "One team's goals"],
                  ["totalGoals", "Total goals"],
                  ["reverseGoalDifference", "Reverse goal diff"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label htmlFor={key} className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {label}
                    </label>
                    <input
                      id={key}
                      type="number"
                      min={0}
                      max={100}
                      value={scoring[key]}
                      onChange={(e) =>
                        setScoring((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))
                      }
                      className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="accumulationMode" className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Accumulation mode
                </label>
                <select
                  id="accumulationMode"
                  value={scoring.accumulationMode}
                  onChange={(e) =>
                    setScoring((s) => ({
                      ...s,
                      accumulationMode: e.target.value as "ACCUMULATE" | "HIGHEST_ONLY",
                    }))
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="ACCUMULATE">Accumulate (sum all matching factors)</option>
                  <option value="HIGHEST_ONLY">Highest only (best single factor)</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={scoring.playoffMultiplier}
                  onChange={(e) =>
                    setScoring((s) => ({ ...s, playoffMultiplier: e.target.checked }))
                  }
                  className="rounded text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Double points for knockout/playoff matches
                </span>
              </label>

              <button
                type="button"
                onClick={() => setScoring(DEFAULT_SCORING)}
                className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim() || !contestId}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Creating…" : "Create group"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
