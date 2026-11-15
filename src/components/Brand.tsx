"use client";
import Link from "next/link";
import { useT } from "@/components/I18nProvider";
import { APP_NAME } from "@/lib/i18n/brand";

/** Kleiner Schriftzug oben links, führt zur Startseite. */
export function Brand() {
  return (
    <Link href="/" className="font-display text-2xl font-extrabold tracking-wide text-accent">
      {APP_NAME}
    </Link>
  );
}

/** Raum-Code als Kinokarte. */
export function TicketCode({ code }: { code: string }) {
  const t = useT();
  return (
    <span className="ticket px-4 py-1.5 text-sm" aria-label={t.common.roomCode(code)}>
      {code}
    </span>
  );
}
