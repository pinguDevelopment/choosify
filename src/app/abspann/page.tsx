import Link from "next/link";
import { AbspannClient } from "@/components/AbspannClient";

export const metadata = { title: "Abspann · Film Aussucher" };

export default function AbspannPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight">
          🎬 Film Aussucher
        </Link>
      </header>
      <div>
        <h1 className="text-3xl font-bold">Abspann</h1>
        <p className="mt-1 text-muted">
          Filme, die eure Crew schon gesehen hat. Sie werden euch nicht mehr vorgeschlagen.
        </p>
      </div>
      <AbspannClient />
    </main>
  );
}
