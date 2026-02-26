import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("admin.heading")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("admin.description")}
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="mb-8 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <AdminTab href="/admin" label={t("admin.competitions")} />
        <AdminTab href="/admin/users" label={t("admin.users")} />
      </nav>

      {children}
    </div>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
    >
      {label}
    </Link>
  );
}
