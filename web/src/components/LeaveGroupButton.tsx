"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/i18n/TranslationProvider";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleLeave = async () => {
    if (!confirm(t("leaveGroup.confirm"))) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || t("leaveGroup.failed"));
      }
    } catch {
      alert(t("leaveGroup.failed"));
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
      {loading ? t("leaveGroup.leaving") : t("leaveGroup.leave")}
    </button>
  );
}
