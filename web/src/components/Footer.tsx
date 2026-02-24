import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-navy-700/20 bg-navy-900 dark:bg-navy-950">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <p className="text-lg font-bold tracking-tight text-gold-400">
              Open Tipper
            </p>
            <p className="mt-2 text-sm leading-6 text-navy-300">
              Predict football scores, compete with friends, and climb the
              leaderboard. Free and open-source.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Product
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/how-it-works"
                    className="text-sm text-navy-300 transition-colors hover:text-white"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signin"
                    className="text-sm text-navy-300 transition-colors hover:text-white"
                  >
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Legal
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-sm text-navy-400">
                    Privacy Policy
                  </span>
                </li>
                <li>
                  <span className="text-sm text-navy-400">
                    Terms of Service
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-navy-800 pt-6 text-center text-xs text-navy-500">
          © {new Date().getFullYear()} Open Tipper. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
