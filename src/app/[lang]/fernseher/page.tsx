import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { HostName } from "@/components/HostName";
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
      <ol className="card flex flex-col gap-4">
        {t.tvSetup.steps(<span className="font-semibold text-accent"><HostName suffix="/tv" /></span>).map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-display font-extrabold text-accent-ink">
              {i + 1}
            </span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">{t.tvSetup.samsung}</p>
      <Link href="/" className="btn-primary text-center">
        {t.common.startRound}
      </Link>
    </main>
  );
}
