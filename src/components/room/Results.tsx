"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { shareLink } from "@/lib/share";
import type { RankingRow, RoomState } from "./types";
import { Confetti } from "./Confetti";
import { useT } from "@/components/I18nProvider";

export function RankingList({ ranking }: { ranking: RankingRow[] }) {
  const t = useT();
  if (!ranking.length) return <p className="text-muted">{t.results.nobody}</p>;
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
          <span className="flex flex-col items-end leading-tight">
            <span className={`font-semibold ${r.unanimous ? "text-yes" : r.acceptable ? "text-accent" : "text-muted"}`}>
              {r.unanimous ? t.results.allLove : r.acceptable ? t.results.allIn : t.results.likes(r.likes)}
            </span>
            {!r.unanimous && (
              <span className="text-xs text-muted">
                {r.acceptable ? t.results.likesMaybes(r.likes, r.maybes) : t.results.maybesNos(r.maybes, r.dislikes)}
              </span>
            )}
          </span>
        </motion.li>
      ))}
      </AnimatePresence>
    </ol>
  );
}

export function Results({ state }: { state: RoomState }) {
  const winner = state.ranking.find((r) => r.tmdbId === state.winner) ?? state.ranking[0];
  const t = useT();
  return (
    <>
      {winner?.unanimous && <Confetti />}
      {winner ? (
        <section className="flex flex-col gap-4 animate-pop">
          <p className="text-lg text-muted">{t.results.tonight}</p>
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
                {winner.unanimous
                  ? t.results.everyone
                  : winner.acceptable
                    ? t.results.allInText(winner.likes, winner.maybes)
                    : t.results.partial(winner.likes, state.participants.length, winner.maybes)}
              </p>
              {state.runoff?.tally && (
                <p className="text-sm text-muted">
                  {state.runoff.decidedByRating
                    ? t.results.runoffByRating(state.runoff.tally[winner.tmdbId] ?? 0)
                    : t.results.runoffWon(state.runoff.tally[winner.tmdbId] ?? 0, state.runoff.votes)}
                </p>
              )}
              <a
                className="btn-ghost self-start py-2.5"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(t.results.trailerQuery(winner.title, winner.year))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.results.trailer}
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          <h1 className="text-3xl">{t.results.noMatchTitle}</h1>
          <p className="mt-2 text-muted">{t.results.noMatchText}</p>
        </section>
      )}
      {winner && state.rateToken && <RateCard token={state.rateToken} title={winner.title} name={state.me?.name ?? ""} />}
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl">{t.results.ranking}</h2>
        {/* Der Gewinner (ggf. aus der Stichwahl) steht immer oben */}
        <RankingList ranking={winner ? [winner, ...state.ranking.filter((r) => r !== winner)] : state.ranking} />
      </section>
      <Link href="/" className="btn-primary">
        {t.results.newRound}
      </Link>
    </>
  );
}

/** Nach dem Film: Sterne vergeben. Der Link geht auch ohne Konto und lässt sich in die Gruppe schicken. */
function RateCard({ token, title, name }: { token: string; title: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const href = `/bewerten/${token}${name ? `?name=${encodeURIComponent(name)}` : ""}`;
  return (
    <section className="card flex flex-col gap-3">
      <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-accent">{t.results.afterFilm}</p>
      <h2 className="text-3xl leading-none">{t.results.howWasIt}</h2>
      <p className="text-muted">{t.results.rateHint}</p>
      <div className="flex gap-3">
        <Link href={href} className="btn-primary flex-1 py-2.5">
          {t.common.rateButton}
        </Link>
        <button
          className="btn-ghost flex-1 py-2.5"
          onClick={async () => {
            if ((await shareLink(`${window.location.origin}/bewerten/${token}`, t.common.rateTitle(title))) === "copied") {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? t.common.copied : t.common.shareLink}
        </button>
      </div>
    </section>
  );
}
