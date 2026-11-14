import { Suspense } from "react";
import { RateClient } from "@/components/RateClient";
import { Brand } from "@/components/Brand";

export const metadata = { title: "Film bewerten – Choosify", robots: { index: false } };

async function Rate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RateClient token={token} />;
}

export default function RatePage({ params }: PageProps<"/bewerten/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
      </header>
      <Suspense fallback={<p className="py-10 text-center text-muted">Lade …</p>}>
        <Rate params={params} />
      </Suspense>
    </main>
  );
}
