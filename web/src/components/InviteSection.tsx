"use client";

import { useState, useCallback } from "react";

interface InviteSectionProps {
  groupId: string;
  groupName: string;
  inviteCode: string;
}

/**
 * InviteSection — invite link display with copy, share (Web Share API), and regenerate.
 * Replaces the simple CopyInviteButton for admins in the Members tab.
 */
export function InviteSection({ groupId, groupName, inviteCode: initialCode }: InviteSectionProps) {
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${inviteCode}`
    : `/join/${inviteCode}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
      const input = document.querySelector<HTMLInputElement>("[data-invite-url]");
      if (input) {
        input.select();
      }
    }
  }, [inviteUrl]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on Open Tipper`,
          text: `Join my prediction group "${groupName}" and compete!`,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled or share failed — ignore AbortError
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    }
  }, [groupName, inviteUrl]);

  const handleRegenerate = useCallback(async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      setTimeout(() => setConfirmRegen(false), 5000); // auto-reset confirmation after 5s
      return;
    }

    setRegenerating(true);
    setConfirmRegen(false);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate");
      const data = await res.json();
      setInviteCode(data.inviteCode);
    } catch (err) {
      console.error("Failed to regenerate invite link:", err);
    } finally {
      setRegenerating(false);
    }
  }, [confirmRegen, groupId]);

  const supportsShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Invite link
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Share this link to invite people to your group.
          </p>
        </div>
      </div>

      {/* Invite URL display + actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          data-invite-url
          readOnly
          value={inviteUrl}
          className="flex-1 truncate rounded bg-white px-3 py-1.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
          onFocus={(e) => e.target.select()}
        />

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title="Copy to clipboard"
        >
          {copied ? (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Copied!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              Copy
            </span>
          )}
        </button>

        {/* Share button (Web Share API — mobile/supported browsers only) */}
        {supportsShare && (
          <button
            type="button"
            onClick={handleShare}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Share invite link"
          >
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
              </svg>
              Share
            </span>
          </button>
        )}
      </div>

      {/* Regenerate link */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Regenerating will invalidate the current link.
        </p>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
            confirmRegen
              ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          } disabled:opacity-50`}
        >
          {regenerating
            ? "Regenerating..."
            : confirmRegen
              ? "Confirm regenerate?"
              : "Regenerate link"}
        </button>
      </div>
    </div>
  );
}
