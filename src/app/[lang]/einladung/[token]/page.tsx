import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteClient } from "@/components/InviteClient";
import { Brand } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { accountsEnabled } from "@/lib/server/db";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("invite"), robots: { index: false } };
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteClient token={token} />;
}

export default async function InvitePage({ params }: PageProps<"/[lang]/einladung/[token]">) {
  // Gemeinsame Watchlists gibt es nur mit Konten
  if (!accountsEnabled()) notFound();
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <LanguageSwitch />
      </header>
      <Suspense fallback={<p className="py-10 text-center text-muted">{t.common.loading}</p>}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}
