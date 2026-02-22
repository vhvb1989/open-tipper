"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveMemberButton({
  groupId,
  userId,
  userName,
}: {
  groupId: string;
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${userName} from this group?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      }
    } catch {
      alert("Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={loading}
      className="rounded-lg px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
