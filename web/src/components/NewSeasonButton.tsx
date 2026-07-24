"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/TranslationProvider";

interface NewSeasonButtonProps {
  groupId: string;
  defaultName?: string;
}

/**
 * Admin action to roll a group over into the current season. Opens a small
 * dialog asking for the new group name, then creates a linked new-season group
 * (members + settings copied) and navigates to it. The existing group is left
 * untouched as a read-only archive.
 */
export function NewSeasonButton({ groupId, defaultName = "" }: NewSeasonButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/new-season`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || (res.status === 409 && data.group?.id)) {
        // Created, or already existed — navigate to the new-season group.
        router.push(`/groups/${data.group.id}`);
        router.refresh();
        return;
      }
      throw new Error(data.error || t("seasonRollover.failed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seasonRollover.failed"));
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400"
      >
        {t("seasonRollover.startNewSeason")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("seasonRollover.dialogTitle")}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("seasonRollover.dialogDescription")}
            </p>
            <label
              htmlFor="new-season-name"
              className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t("seasonRollover.nameLabel")}
            </label>
            <input
              id="new-season-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("seasonRollover.namePlaceholder")}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-gold-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t("seasonRollover.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400 disabled:opacity-50"
              >
                {loading ? t("seasonRollover.creating") : t("seasonRollover.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
