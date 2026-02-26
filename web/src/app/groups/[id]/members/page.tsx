import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { RemoveMemberButton } from "@/components/RemoveMemberButton";
import { LeaveGroupButton } from "@/components/LeaveGroupButton";
import { InviteSection } from "@/components/InviteSection";

export default async function GroupMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      visibility: true,
      inviteCode: true,
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });

  if (!group) notFound();

  const currentUserMembership = group.memberships.find((m) => m.user.id === session?.user?.id);
  const isAdmin = currentUserMembership?.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Invite link (admin only) */}
      {isAdmin && (
        <InviteSection groupId={group.id} groupName={group.name} inviteCode={group.inviteCode} />
      )}

      {/* Member list */}
      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {group.memberships.map((membership) => (
          <div key={membership.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {membership.user.image ? (
                <Image
                  src={membership.user.image}
                  alt={membership.user.name ?? "User"}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {(membership.user.name ?? membership.user.email ?? "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {membership.user.name ?? membership.user.email ?? "Unknown user"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {membership.role === "ADMIN" ? "Admin" : "Member"} · Joined{" "}
                  {new Date(membership.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {membership.role === "ADMIN" && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Admin
                </span>
              )}
              {/* Admin can remove other members */}
              {isAdmin && membership.user.id !== session?.user?.id && (
                <RemoveMemberButton
                  groupId={group.id}
                  userId={membership.user.id}
                  userName={membership.user.name ?? "this member"}
                />
              )}
              {/* Non-admin members can leave */}
              {membership.user.id === session?.user?.id && membership.role !== "ADMIN" && (
                <LeaveGroupButton groupId={group.id} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
