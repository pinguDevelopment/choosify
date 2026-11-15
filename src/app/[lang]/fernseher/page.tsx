import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { FernseherClient } from "@/components/FernseherClient";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("tv") };
}

export default async function FernseherPage() {
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <nav className="flex items-center gap-4">
          <Link href="/abspann" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.abspann}
          </Link>
          <Link href="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            {t.common.newRound}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>
      <div>
        <h1 className="text-5xl">{t.tvSetup.title}</h1>
        <p className="mt-2 text-muted">{t.tvSetup.intro}</p>
      </div>
      <FernseherClient />
    </main>
  );
}
