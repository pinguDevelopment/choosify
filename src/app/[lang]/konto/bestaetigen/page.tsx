import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/Brand";
import { ConfirmLogin } from "@/components/ConfirmLogin";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("signIn"), referrer: "no-referrer" };
}

async function Confirm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).token_hash;
  const tokenHash = typeof raw === "string" && /^[A-Za-z0-9._-]{8,200}$/.test(raw) ? raw : null;
  return <ConfirmLogin tokenHash={tokenHash} />;
}

export default async function ConfirmPage({ searchParams }: PageProps<"/[lang]/konto/bestaetigen">) {
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <LanguageSwitch />
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
