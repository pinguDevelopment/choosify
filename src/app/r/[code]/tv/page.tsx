import { Suspense } from "react";
import { TvScreen } from "@/components/TvScreen";

export const metadata = { title: "Fernseher – Filmabend" };

async function Screen({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TvScreen code={code.toUpperCase()} />;
}

/** Fernseh-Ansicht einer laufenden Runde (z. B. vom Host per "Auf dem Fernseher zeigen"). */
export default function RoomTvPage({ params }: PageProps<"/r/[code]/tv">) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-2xl text-muted">Lade Runde …</p>}>
      <Screen params={params} />
    </Suspense>
  );
}
