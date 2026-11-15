import type { Metadata } from "next";
import { Suspense } from "react";
import { TvScreen } from "@/components/TvScreen";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("tv") };
}

async function Screen({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TvScreen code={code.toUpperCase()} />;
}

/** Fernseh-Ansicht einer laufenden Runde (z. B. vom Host per "Auf dem Fernseher zeigen"). */
export default async function RoomTvPage({ params }: PageProps<"/[lang]/r/[code]/tv">) {
  const t = MESSAGES[await pageLocale()];
  return (
    <Suspense fallback={<p className="py-10 text-center text-2xl text-muted">{t.common.loadingRound}</p>}>
      <Screen params={params} />
    </Suspense>
  );
}
