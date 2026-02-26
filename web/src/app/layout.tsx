import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NavBar } from "@/components/NavBar";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Open Tipper",
  description:
    "Score prediction with your mates — predict football match scores and compete on leaderboards.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const t = getT(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'classic'}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Skip-to-content link for keyboard / screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-navy-900 focus:shadow-lg"
        >
          {t("accessibility.skipToContent")}
        </a>
        <Providers locale={locale}>
          <NavBar />
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
