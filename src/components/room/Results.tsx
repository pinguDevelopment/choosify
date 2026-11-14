"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { RankingRow, RoomState } from "./types";
import { Confetti } from "./Confetti";

export function RankingList({ ranking }: { ranking: RankingRow[] }) {
  if (!ranking.length) return <p className="text-muted">Noch hat niemand Ja gesagt.</p>;
  return (
    <ol className="flex flex-col">
      <AnimatePresence initial={false}>
      {ranking.map((r, i) => (
        // layout: Plätze tauschen weich, wenn sich der Live-Stand ändert
        <motion.li
          layout
          key={r.tmdbId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-0"
        >
          <span className="w-7 text-center font-display text-2xl font-extrabold text-muted">{i + 1}</span>
          {r.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.poster} alt="" className="h-14 w-10 rounded-md object-cover" />
          ) : (
            <div className="h-14 w-10 rounded-md bg-surface-2" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{r.title}</p>
            <p className="text-sm text-muted">{r.year ?? ""}</p>
          </div>
          <span className={`font-semibold ${r.unanimous ? "text-yes" : "text-muted"}`}>
            {r.unanimous ? "alle ♥" : `${r.likes} ♥`}
          </span>
        </motion.li>
      ))}
      </AnimatePresence>
    </ol>
  );
}

export function Results({ state }: { state: RoomState }) {
  const winner = state.ranking.find((r) => r.tmdbId === state.winner) ?? state.ranking[0];
  return (
    <>
      {winner?.unanimous && <Confetti />}
      {winner ? (
        <section className="flex flex-col gap-4 animate-pop">
          <p className="text-lg text-muted">Heute läuft</p>
          <div className="marquee text-center">
            <h1 className="marquee-text text-[clamp(2.4rem,11vw,3.6rem)]">{winner.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {winner.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={winner.poster} alt="" className="h-28 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <div className="flex flex-col gap-3">
              <p className="text-lg">
                {winner.unanimous ? "Alle haben Bock." : `${winner.likes} von ${state.participants.length} haben Bock.`}
              </p>
              <a
                className="btn-ghost self-start py-2.5"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${winner.title} ${winner.year ?? ""} Trailer deutsch`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Trailer suchen
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          <h1 className="text-3xl">Kein Treffer</h1>
          <p className="mt-2 text-muted">Niemand hat Ja gesagt. Startet eine neue Runde mit anderen Genres oder mehr Diensten.</p>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl">Rangliste</h2>
        <RankingList ranking={state.ranking} />
      </section>
      <Link href="/" className="btn-primary">
        Neue Runde starten
      </Link>
    </>
  );
}
