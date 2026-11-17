import type { Metadata } from "next";
import Link from "next/link";
import { AbspannClient } from "@/components/AbspannClient";
import { accountsEnabled } from "@/lib/server/db";
import { Brand } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("abspann") };
}

export default async function WatchlistPage() {
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <Link href="/fernseher" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.tv}
          </Link>
          {accountsEnabled() && (
            <Link href="/konto" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
              {t.common.account}
            </Link>
          )}
          <Link href="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.newRound}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>
      <div>
        <h1 className="text-5xl">{t.abspann.title}</h1>
        <p className="mt-2 text-muted">{t.abspann.intro}</p>
      </div>
      <AbspannClient accounts={accountsEnabled()} />
    </main>
  );
}
