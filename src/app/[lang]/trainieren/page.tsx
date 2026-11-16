import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { accountsEnabled } from "@/lib/server/db";
import { Brand } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { TrainClient } from "@/components/TrainClient";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("train") };
}

/** „Train my Algorithm“: allein Filme bewerten, damit Gruppenrunden besser passen. Braucht ein Konto. */
export default async function TrainPage() {
  // Beim Self-Hosten ohne Konten gibt es nichts, wo der Geschmack gespeichert werden könnte
  if (!accountsEnabled()) notFound();
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <nav className="flex items-center gap-4">
          <Link href="/konto" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.account}
          </Link>
          <Link href="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.newRound}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>
      <div>
        <h1 className="text-5xl">{t.train.title}</h1>
        <p className="mt-2 text-muted">{t.train.intro}</p>
      </div>
      <TrainClient />
    </main>
  );
}
