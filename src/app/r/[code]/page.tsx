import { Suspense } from "react";
import { RoomClient } from "@/components/room/RoomClient";

export const metadata = { title: "Runde – Choosify" };

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted">Lade Runde …</p>}>
      <Room params={params} />
    </Suspense>
  );
}
