"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    if (!confirm("Leave this group? You can rejoin later if the group is public or you have an invite link.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to leave group");
      }
    } catch {
      alert("Failed to leave group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={loading}
      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      {loading ? "Leaving…" : "Leave group"}
    </button>
  );
}
