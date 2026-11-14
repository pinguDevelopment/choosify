import Link from "next/link";
import { Brand } from "@/components/Brand";
import { KontoClient } from "@/components/KontoClient";

export const metadata = { title: "Konto – Choosify" };

export default function KontoPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href="/abspann" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
          Abspann
        </Link>
      </header>
      <div>
        <h1 className="text-5xl">Konto</h1>
        <p className="mt-2 text-muted">
          Freiwillig und nur für Hosts: Mit Konto sind eure Crews, der Abspann und deine Lieblingsdienste auf jedem Gerät da.
          Gäste brauchen weiterhin nur ihren Namen.
        </p>
      </div>
      <KontoClient />
    </main>
  );
}
