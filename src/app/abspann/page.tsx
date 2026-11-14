import { AbspannClient } from "@/components/AbspannClient";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata = { title: "Abspann – Choosify" };

export default function AbspannPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
          Neue Runde
        </Link>
      </header>
      <div>
        <h1 className="text-5xl">Abspann</h1>
        <p className="mt-2 text-muted">
          Was eure Crew schon gesehen hat. Diese Filme schlagen wir euch nicht mehr vor.
        </p>
      </div>
      <AbspannClient />
    </main>
  );
}
