import Link from "next/link";
import { CreateRoom } from "@/components/CreateRoom";
import { JoinByCode } from "@/components/JoinByCode";
import { LoginLinkFallback } from "@/components/LoginLinkFallback";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-4 pt-8 pb-12">
      <header className="flex flex-col gap-5">
        <div className="marquee text-center">
          <h1 className="marquee-text text-[clamp(2.6rem,calc(21vw-1.4rem),4.6rem)]">Filmabend</h1>
        </div>
        <p className="text-lg text-muted">
          Jeder wischt durch Filme, die bei euch laufen. Am Ende steht der eine, auf den alle Bock haben.
        </p>
      </header>
      <LoginLinkFallback />
      <CreateRoom />
      <JoinByCode />
      <Link href="/abspann" className="text-muted underline decoration-line underline-offset-4 hover:text-text">
        Abspann: eure schon gesehenen Filme
      </Link>
      <Link href="/konto" className="-mt-7 text-muted underline decoration-line underline-offset-4 hover:text-text">
        Konto: Crews und Abspann auf allen Geräten
      </Link>
    </main>
  );
}
