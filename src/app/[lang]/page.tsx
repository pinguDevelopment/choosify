import Link from "next/link";
import { CreateRoom } from "@/components/CreateRoom";
import { JoinByCode } from "@/components/JoinByCode";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LoginLinkFallback } from "@/components/LoginLinkFallback";
import { MESSAGES } from "@/lib/i18n/messages";
import { APP_NAME, pageLocale } from "@/lib/i18n/page";

export default async function Home() {
  const t = MESSAGES[await pageLocale()];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-4 pt-4 pb-12">
      <header className="flex flex-col gap-5">
        <LanguageSwitch className="self-end" />
        <div className="marquee text-center">
          <h1 className="marquee-text text-[clamp(2.6rem,calc(21vw-1.4rem),4.6rem)]">{APP_NAME}</h1>
        </div>
        <p className="text-lg text-muted">{t.home.tagline}</p>
      </header>
      <LoginLinkFallback />
      <CreateRoom />
      <JoinByCode />
      <Link href="/abspann" className="text-muted underline decoration-line underline-offset-4 hover:text-text">
        {t.home.abspannLink}
      </Link>
      <Link href="/konto" className="-mt-7 text-muted underline decoration-line underline-offset-4 hover:text-text">
        {t.home.accountLink}
      </Link>
      <Link href="/fernseher" className="-mt-7 text-muted underline decoration-line underline-offset-4 hover:text-text">
        {t.home.tvLink}
      </Link>
    </main>
  );
}
