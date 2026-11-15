"use client";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { TvScreen } from "@/components/TvScreen";
import { useT } from "@/components/I18nProvider";
import { APP_NAME } from "@/lib/i18n/brand";

// Fernseher koppeln: Der Fernseher zeigt einen kurzen Code, der Host tippt ihn in der Lobby ein.
// Der Fernseher fragt alle zwei Sekunden nach und schaltet von selbst auf den QR-Code der Runde.
// Am Fernseher muss man nichts bedienen. Das Geheimnis liegt im localStorage, damit der Fernseher
// nach dem Neuladen dieselbe Runde wieder zeigt.

const STORE = "cinemood:tv-secret";
type Pairing = { code: string; secret: string; expiresAt: string };
type Status = { code: string; roomCode: string | null; expiresAt: string };

const load = () => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};
const save = (secret: string | null) => {
  try {
    if (secret) localStorage.setItem(STORE, secret);
    else localStorage.removeItem(STORE);
  } catch {
    // Ohne Speicher klappt es trotzdem, nur nicht über ein Neuladen hinweg
  }
};

/** "K7Q2XH" → "K7Q 2XH", lässt sich vom Sofa aus besser lesen. */
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export function TvPair() {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  // Nach dem Ende einer Runde: Gewinner bleibt stehen, darunter der Code für die nächste
  const [replacing, setReplacing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [homeQr, setHomeQr] = useState<{ url: string; img: string } | null>(null);
  const ref = useRef({ secret: null as string | null, replacing: false, wake: () => {} });

  useEffect(() => {
    const url = window.location.origin;
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#2a0a14", light: "#f6e7da" } }).then((img) =>
      setHomeQr({ url, img }),
    );
  }, []);

  useEffect(() => {
    const r = ref.current;
    r.secret = load();
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let running = false;

    const tick = async () => {
      running = true;
      let delay = 2000;
      try {
        if (!r.secret) {
          const p = await api<Pairing>("/api/tv", { body: {} });
          r.secret = p.secret;
          save(p.secret);
        }
        const secret = r.secret;
        const res = await api<Status | { gone: true }>("/api/tv/status", { body: { secret } });
        if (stop) return;
        if (r.secret !== secret) {
          // Inzwischen wurde ein neuer Code angefordert (Runde vorbei), Antwort ist veraltet
          delay = 0;
        } else if ("gone" in res) {
          // Code abgelaufen oder Runde vorbei: gleich einen neuen holen
          r.secret = null;
          save(null);
          if (!r.replacing) setRoom(null);
          delay = 0;
        } else {
          const st = res;
          setCode(st.code);
          if (st.roomCode) {
            setRoom(st.roomCode);
            r.replacing = false;
            setReplacing(false);
            delay = 15000; // gekoppelt: Die Runde fragt selbst nach, hier reicht selten
          } else if (!r.replacing) setRoom(null);
        }
        setOffline(false);
      } catch {
        if (!stop) setOffline(true);
        delay = 5000;
      }
      running = false;
      if (!stop) timer = setTimeout(tick, document.hidden ? Math.max(delay, 10000) : delay);
    };
    r.wake = () => {
      // Läuft gerade eine Abfrage, merkt sie selbst, dass der Code veraltet ist
      if (running) return;
      clearTimeout(timer);
      timer = setTimeout(tick, 0);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  // Runde vorbei: neuen Code holen, der Gewinner bleibt so lange stehen
  const onStatus = useCallback((status: string) => {
    const r = ref.current;
    if (status !== "done" || r.replacing) return;
    r.replacing = true;
    r.secret = null;
    save(null);
    setReplacing(true);
    setCode(null);
    r.wake();
  }, []);

  if (room)
    return (
      <TvScreen
        key={room}
        code={room}
        onStatus={onStatus}
        footer={
          replacing && code ? (
            <p className="mt-4 text-[clamp(1.1rem,2vw,1.8rem)] text-muted">
              {t.tv.nextRound(
                <span className="ticket mx-1 px-4 py-1 align-middle tracking-[0.2em]" aria-label={t.tv.pairCodeLabel(code)}>
                  {spaced(code)}
                </span>,
              )}
            </p>
          ) : null
        }
      />
    );

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 p-[clamp(1rem,3vw,3rem)]">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-[clamp(1.6rem,3vw,3rem)] font-extrabold tracking-wide text-accent">{APP_NAME}</p>
        {offline && <p className="text-[clamp(0.9rem,1.5vw,1.3rem)] text-no">{t.tv.failed}</p>}
      </header>
      <section className="grid flex-1 items-center gap-[clamp(1.5rem,4vw,4rem)] md:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-[clamp(1rem,2.5vw,2.5rem)]">
          <h1 className="text-[clamp(2.4rem,5vw,5rem)] leading-none">{t.tv.pairTitle}</h1>
          {code ? (
            <p
              className="ticket self-start px-[clamp(1.5rem,3vw,3rem)] py-[clamp(0.5rem,1.5vw,1.5rem)] font-display text-[clamp(3.5rem,11vw,10rem)] font-extrabold leading-none tracking-[0.15em]"
              aria-label={t.tv.pairCodeLabel(code)}
            >
              {spaced(code)}
            </p>
          ) : (
            <p className="text-[clamp(1.4rem,3vw,2.6rem)] text-muted">{t.tv.preparing}</p>
          )}
          <ol className="flex flex-col gap-3 text-[clamp(1.1rem,2.2vw,2rem)]">
            {t.tv.pairSteps.map((s, i) => (
              <li key={s} className="flex items-center gap-4">
                <span className="grid h-[1.8em] w-[1.8em] shrink-0 place-items-center rounded-full bg-accent font-display font-extrabold text-accent-ink">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="text-[clamp(0.9rem,1.5vw,1.3rem)] text-muted">{t.tv.pairRenew}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-[clamp(1rem,1.8vw,1.6rem)] text-muted">{t.tv.pairStart}</p>
          {homeQr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL
            <img src={homeQr.img} alt={t.tv.pairQrAlt(homeQr.url)} className="aspect-square w-[min(36vw,34vh)] rounded-2xl" />
          ) : (
            <div className="aspect-square w-[min(36vw,34vh)] animate-pulse rounded-2xl bg-surface-2" />
          )}
          <p className="text-center text-[clamp(0.9rem,1.5vw,1.3rem)] text-muted">{homeQr?.url.replace(/^https?:\/\//, "")}</p>
        </div>
      </section>
    </main>
  );
}
