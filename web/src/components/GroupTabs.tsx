"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface GroupTabsProps {
  groupId: string;
  isAdmin: boolean;
  isMember: boolean;
}

export function GroupTabs({ groupId, isAdmin, isMember }: GroupTabsProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Predictions", href: `/groups/${groupId}`, exact: true },
    { label: "Standings", href: `/groups/${groupId}/standings` },
    { label: "Results", href: `/groups/${groupId}/results` },
    ...(isMember ? [{ label: "Members", href: `/groups/${groupId}/members` }] : []),
    ...(isAdmin ? [{ label: "Settings", href: `/groups/${groupId}/settings` }] : []),
  ];

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
