"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/TranslationProvider";

interface BadgePopoverProps {
  /** The badge element to render (clickable trigger) */
  badge: React.ReactNode;
  /** Full name of the badge */
  title: string;
  /** Explanation of what the badge means */
  description: string;
  /** Optional points string (e.g. "+10 pts") */
  points?: string;
}

function computePopoverStyle(triggerEl: HTMLElement): {
  top: number;
  left: number;
  placement: "above" | "below";
} {
  const rect = triggerEl.getBoundingClientRect();
  const popoverHeight = 120;
  const gap = 8;
  const placement = rect.top < popoverHeight + gap ? "below" : "above";
  const centerX = rect.left + rect.width / 2;
  const top =
    placement === "above" ? rect.top + window.scrollY - gap : rect.bottom + window.scrollY + gap;
  return { top, left: centerX, placement };
}

export default function BadgePopover({ badge, title, description, points }: BadgePopoverProps) {
  const [popoverState, setPopoverState] = useState<{
    open: boolean;
    top: number;
    left: number;
    placement: "above" | "below";
  }>({ open: false, top: 0, left: 0, placement: "above" });

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  const close = useCallback(() => setPopoverState((s) => ({ ...s, open: false })), []);

  const toggle = useCallback(() => {
    setPopoverState((prev) => {
      if (prev.open) return { ...prev, open: false };
      if (!triggerRef.current) return prev;
      const { top, left, placement } = computePopoverStyle(triggerRef.current);
      return { open: true, top, left, placement };
    });
  }, []);

  // Close on scroll/resize
  useEffect(() => {
    if (!popoverState.open) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [popoverState.open, close]);

  // Close on outside click
  useEffect(() => {
    if (!popoverState.open) return;

    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverState.open, close]);

  // Close on Escape
  useEffect(() => {
    if (!popoverState.open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [popoverState.open, close]);

  const popoverContent = popoverState.open ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      style={{
        position: "absolute",
        top: popoverState.top,
        left: popoverState.left,
        transform: `translateX(-50%) ${popoverState.placement === "above" ? "translateY(-100%)" : ""}`,
      }}
      className="z-[9999] w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      {/* Close button — always visible, touch-friendly */}
      <button
        type="button"
        onClick={close}
        aria-label={t("common.close")}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="pr-6 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      {points && (
        <p className="mt-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">{points}</p>
      )}

      {/* Arrow */}
      <div
        className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${
          popoverState.placement === "above"
            ? "-bottom-1.5 border-b border-r"
            : "-top-1.5 border-l border-t"
        }`}
      />
    </div>
  ) : null;

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="cursor-pointer"
        aria-expanded={popoverState.open}
        aria-haspopup="dialog"
      >
        {badge}
      </button>

      {popoverContent &&
        typeof document !== "undefined" &&
        createPortal(popoverContent, document.body)}
    </span>
  );
}
