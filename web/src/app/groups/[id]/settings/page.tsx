"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ScoringRules {
  exactScore: number;
  goalDifference: number;
  outcome: number;
  oneTeamGoals: number;
  totalGoals: number;
  reverseGoalDifference: number;
  accumulationMode: "ACCUMULATE" | "HIGHEST_ONLY";
  playoffMultiplier: boolean;
}

interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  inviteCode?: string;
  scoringRules: ScoringRules | null;
  role: string | null;
}

export default function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState<string>("");
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [scoring, setScoring] = useState<ScoringRules>({
    exactScore: 10,
    goalDifference: 6,
    outcome: 4,
    oneTeamGoals: 3,
    totalGoals: 2,
    reverseGoalDifference: 1,
    accumulationMode: "ACCUMULATE",
    playoffMultiplier: false,
  });

  useEffect(() => {
    params.then(({ id }) => setGroupId(id));
  }, [params]);

  useEffect(() => {
    if (!groupId) return;
    fetch(`/api/groups/${groupId}`)
      .then((res) => res.json())
      .then((data) => {
        const g = data.group;
        setGroup(g);
        setName(g.name);
        setDescription(g.description ?? "");
        setVisibility(g.visibility);
        if (g.scoringRules) {
          setScoring(g.scoringRules);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load group settings");
        setLoading(false);
      });
  }, [groupId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          visibility,
          scoringRules: scoring,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete group");
        setDeleting(false);
      }
    } catch {
      alert("Failed to delete group");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  if (!group || group.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Only group admins can access settings.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="max-w-xl space-y-6">
      {/* Group Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Group name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
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
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Private</span>
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
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Public</span>
          </label>
        </div>
      </div>

      {/* Scoring Rules */}
      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Scoring Rules
        </h3>

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
              <label htmlFor={`settings-${key}`} className="block text-xs text-zinc-500 dark:text-zinc-400">
                {label}
              </label>
              <input
                id={`settings-${key}`}
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
          <label htmlFor="settings-accumulationMode" className="block text-xs text-zinc-500 dark:text-zinc-400">
            Accumulation mode
          </label>
          <select
            id="settings-accumulationMode"
            value={scoring.accumulationMode}
            onChange={(e) =>
              setScoring((s) => ({
                ...s,
                accumulationMode: e.target.value as "ACCUMULATE" | "HIGHEST_ONLY",
              }))
            }
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="ACCUMULATE">Accumulate</option>
            <option value="HIGHEST_ONLY">Highest only</option>
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
      </div>

      {/* Feedback */}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
          Settings saved successfully.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {deleting ? "Deleting…" : "Delete group"}
        </button>
      </div>
    </form>
  );
}
