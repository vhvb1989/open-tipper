"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/TranslationProvider";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-navy-700/20 bg-navy-900 dark:bg-navy-950">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <p className="text-lg font-bold tracking-tight text-gold-400">{t("footer.brand")}</p>
            <p className="mt-2 text-sm leading-6 text-navy-300">{t("footer.description")}</p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                {t("footer.product")}
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/how-it-works"
                    className="text-sm text-navy-300 transition-colors hover:text-white"
                  >
                    {t("footer.howItWorks")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signin"
                    className="text-sm text-navy-300 transition-colors hover:text-white"
                  >
                    {t("footer.signIn")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                {t("footer.legal")}
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-sm text-navy-400">{t("footer.privacyPolicy")}</span>
                </li>
                <li>
                  <span className="text-sm text-navy-400">{t("footer.termsOfService")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-navy-800 pt-6 text-center text-xs text-navy-500">
          {t("footer.copyright", { year: String(new Date().getFullYear()) })}
        </div>
      </div>
    </footer>
  );
}
