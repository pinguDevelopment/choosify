import Link from "next/link";
import { CreateRoom } from "@/components/CreateRoom";
import { JoinByCode } from "@/components/JoinByCode";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <p className="text-4xl">🎬</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Film Aussucher</h1>
        <p className="mt-2 text-muted">Alle swipen, einer gewinnt. Nie wieder eine Stunde Netflix-Scrollen.</p>
      </header>
      <CreateRoom />
      <JoinByCode />
      <Link href="/abspann" className="text-center text-sm text-muted underline-offset-4 hover:underline">
        Zum Abspann eurer Crew (schon gesehene Filme)
      </Link>
    </main>
  );
}
