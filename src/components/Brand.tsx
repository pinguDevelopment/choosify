import Link from "next/link";

/** Kleiner Schriftzug oben links, führt zur Startseite. */
export function Brand() {
  return (
    <Link href="/" className="font-display text-2xl font-extrabold tracking-wide text-accent">
      Filmabend
    </Link>
  );
}

/** Raum-Code als Kinokarte. */
export function TicketCode({ code }: { code: string }) {
  return (
    <span className="ticket px-4 py-1.5 text-sm" aria-label={`Raum-Code ${code}`}>
      {code}
    </span>
  );
}
