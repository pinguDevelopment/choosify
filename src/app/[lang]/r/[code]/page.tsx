import type { Metadata } from "next";
import { Suspense } from "react";
import { RoomClient } from "@/components/room/RoomClient";
import { MESSAGES } from "@/lib/i18n/messages";
import { pageLocale, pageTitle } from "@/lib/i18n/page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await pageTitle("round") };
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}

export default async function RoomPage({ params }: PageProps<"/[lang]/r/[code]">) {
  const t = MESSAGES[await pageLocale()];
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted">{t.common.loadingRound}</p>}>
      <Room params={params} />
    </Suspense>
  );
}
