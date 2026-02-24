"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JoinGroupButtonProps {
  groupId: string;
  isAuthenticated: boolean;
}

export function JoinGroupButton({
  groupId,
  isAuthenticated,
}: JoinGroupButtonProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          // Already a member — just refresh
          router.refresh();
          return;
        }
        throw new Error(data.error || "Failed to join group");
      }

      // Successfully joined — refresh the page to show member UI
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleJoin}
        disabled={joining}
        className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400 disabled:opacity-50"
      >
        {joining ? "Joining..." : "Join group"}
      </button>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
