"use client";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Confetti } from "@/components/room/Confetti";
import { useT } from "@/components/I18nProvider";
import { APP_NAME } from "@/lib/i18n/brand";

// Großansicht für den Fernseher: QR-Code zum Beitreten, wer da ist, Fortschritt beim Swipen
// und am Ende der Gewinner. Bedienen muss man hier nichts, alles läuft über die Handys.

type TvState = {
  code: string;
  status: "lobby" | "voting" | "runoff" | "done";
  movieCount: number;
  participants: { name: string; isHost: boolean; genresDone: boolean; voted: number }[];
  runoffCount: number;
  winner: { title: string; poster: string | null; year: number | null } | null;
};

export function TvScreen({ code, onNew, busyNew }: { code: string; onNew?: () => void; busyNew?: boolean }) {
  const [state, setState] = useState<TvState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ url: string; img: string } | null>(null);
  const t = useT();

  useEffect(() => {
    const url = `${window.location.origin}/r/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 720, color: { dark: "#2a0a14", light: "#f6e7da" } }).then((img) =>
      setQr({ url, img }),
    );
  }, [code]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api<TvState>(`/api/rooms/${code}/tv`);
        if (stop) return;
        setState(s);
        setError(null);
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      // Nach dem Ende reicht seltenes Nachfragen
      if (!stop) timer = setTimeout(tick, document.hidden ? 15000 : 3000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code]);

  const people = state?.participants ?? [];
  const host = people.find((p) => p.isHost);
  const shortUrl = qr ? qr.url.replace(/^https?:\/\//, "") : "";

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-dvh w-full flex-col gap-6 p-[clamp(1rem,3vw,3rem)]">
        <header className="flex items-center justify-between gap-4">
          <p className="font-display text-[clamp(1.6rem,3vw,3rem)] font-extrabold tracking-wide text-accent">{APP_NAME}</p>
          <span className="ticket px-5 py-2 text-[clamp(0.9rem,1.6vw,1.4rem)]" aria-label={t.common.roomCode(code)}>
            {code}
          </span>
        </header>

        {error && !state && <p className="text-center text-2xl text-no">{error}</p>}

        {(!state || state.status === "lobby") && (
          <section className="grid flex-1 items-center gap-[clamp(1.5rem,4vw,4rem)] md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL
                <img
                  src={qr.img}
                  alt={t.common.qrJoin(qr.url)}
                  className="aspect-square w-[min(70vw,58vh)] rounded-2xl shadow-[0_0_60px_rgb(255_201_77/0.18)]"
                />
              ) : (
                <div className="aspect-square w-[min(70vw,58vh)] animate-pulse rounded-2xl bg-surface-2" />
              )}
              <p className="text-center text-[clamp(0.9rem,1.5vw,1.3rem)] text-muted">{shortUrl}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <h1 className="text-[clamp(2.6rem,6vw,6rem)] leading-none">{t.tv.scan}</h1>
              <p className="text-[clamp(1.1rem,2vw,1.8rem)] text-muted">
                {host ? t.tv.hostLeads(host.name) : t.tv.firstLeads}
              </p>
              <p className="font-display text-[clamp(1.6rem,3vw,2.8rem)] font-extrabold">
                {people.length === 0 ? t.tv.nobody : t.tv.inRoom(people.length)}
              </p>
              <ul className="flex flex-wrap gap-3">
                <AnimatePresence initial={false}>
                  {people.map((p) => (
                    <motion.li
                      key={p.name}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 26 }}
                      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[clamp(1rem,1.8vw,1.6rem)] ${
                        p.genresDone ? "bg-accent text-accent-ink" : "bg-surface-2 text-text"
                      }`}
                    >
                      {p.name}
                      {p.genresDone && <span aria-label={t.tv.ready}>✓</span>}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </section>
        )}

        {state && (state.status === "voting" || state.status === "runoff") && (
          <section className="flex flex-1 flex-col justify-center gap-8">
            <h1 className="text-[clamp(2.6rem,6vw,6rem)] leading-none">
              {state.status === "runoff" ? t.tv.runoff(state.runoffCount) : t.tv.swiping}
            </h1>
            {state.status === "voting" ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {people.map((p) => {
                  const pct = state.movieCount ? Math.min(100, Math.round((p.voted / state.movieCount) * 100)) : 0;
                  return (
                    <li key={p.name} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between text-[clamp(1rem,1.8vw,1.6rem)]">
                        <span className="truncate">{p.name}</span>
                        <span className="text-muted">
                          {p.voted} / {state.movieCount}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                        <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[clamp(1.1rem,2vw,1.8rem)] text-muted">{t.tv.runoffHint}</p>
            )}
            <p className="text-[clamp(1rem,1.6vw,1.4rem)] text-muted">{t.tv.lateJoin(shortUrl)}</p>
          </section>
        )}

        {state?.status === "done" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            {state.winner && <Confetti count={60} />}
            <p className="text-[clamp(1.2rem,2.2vw,2rem)] text-muted">{t.tv.tonight}</p>
            {state.winner ? (
              <div className="flex flex-col items-center gap-6 md:flex-row md:text-left">
                {state.winner.poster && (
                  // eslint-disable-next-line @next/next/no-img-element -- TMDB-Poster, feste Größe
                  <img src={state.winner.poster} alt="" className="h-[48vh] rounded-xl shadow-2xl" />
                )}
                <div className="marquee max-w-[60vw]">
                  <h1 className="marquee-text text-[clamp(2.6rem,7vw,7rem)]">{state.winner.title}</h1>
                  {state.winner.year && <p className="mt-2 text-center text-xl text-muted">{state.winner.year}</p>}
                </div>
              </div>
            ) : (
              <h1 className="text-[clamp(2.6rem,6vw,6rem)]">{t.tv.noWinner}</h1>
            )}
            {onNew && (
              <button className="btn-primary mt-4 text-xl" onClick={onNew} disabled={busyNew}>
                {busyNew ? t.tv.creating : t.common.newRound}
              </button>
            )}
          </section>
        )}
      </main>
    </MotionConfig>
  );
}
