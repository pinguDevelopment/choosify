import Link from "next/link";
import { Brand } from "@/components/Brand";
import { FernseherClient } from "@/components/FernseherClient";

export const metadata = { title: "Fernseher – Filmabend" };

export default function FernseherPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <nav className="flex gap-4">
          <Link href="/abspann" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            Abspann
          </Link>
          <Link href="/" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-text">
            Neue Runde
          </Link>
        </nav>
      </header>
      <div>
        <h1 className="text-5xl">Fernseher</h1>
        <p className="mt-2 text-muted">
          Ein fester Link für euren Fernseher: Öffnet ihn dort im Browser, und schon steht eine neue Runde mit großem QR-Code
          bereit. Home Assistant kann den Link automatisch öffnen, es geht aber genauso von Hand.
        </p>
      </div>
      <FernseherClient />
    </main>
  );
}
