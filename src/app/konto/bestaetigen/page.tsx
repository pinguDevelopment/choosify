import { Suspense } from "react";
import { Brand } from "@/components/Brand";
import { ConfirmLogin } from "@/components/ConfirmLogin";

export const metadata = { title: "Anmelden – Choosify", referrer: "no-referrer" as const };

async function Confirm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).token_hash;
  const tokenHash = typeof raw === "string" && /^[A-Za-z0-9._-]{8,200}$/.test(raw) ? raw : null;
  return <ConfirmLogin tokenHash={tokenHash} />;
}

export default function ConfirmPage({ searchParams }: PageProps<"/konto/bestaetigen">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header>
        <Brand />
      </header>
      <Suspense fallback={<p className="text-muted">Lade …</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
