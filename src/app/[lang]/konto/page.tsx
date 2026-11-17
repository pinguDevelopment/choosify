import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { accountsEnabled } from "@/lib/server/db";
import { Brand } from "@/components/Brand";
import { KontoClient } from "@/components/KontoClient";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("account") };
}

export default async function KontoPage() {
  // Beim Self-Hosten (MariaDB/SQLite) gibt es keine Konten
  if (!accountsEnabled()) notFound();
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <Link href="/trainieren" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.train}
          </Link>
          <Link href="/watchlist" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.abspann}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>
      <div>
        <h1 className="text-5xl">{t.account.title}</h1>
        <p className="mt-2 text-muted">{t.account.intro}</p>
      </div>
      <KontoClient />
    </main>
  );
}
