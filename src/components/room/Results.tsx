import Link from "next/link";
import type { RankingRow, RoomState } from "./types";

export function RankingList({ ranking }: { ranking: RankingRow[] }) {
  if (!ranking.length) return <p className="text-sm text-muted">Noch keine Zusagen.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {ranking.map((r, i) => (
        <li key={r.tmdbId} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2 pr-4">
          <span className="w-6 text-center font-mono text-muted">{i + 1}</span>
          {r.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.poster} alt="" className="h-14 w-10 rounded-md object-cover" />
          ) : (
            <div className="grid h-14 w-10 place-items-center rounded-md bg-surface">🎞️</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.title}</p>
            <p className="text-xs text-muted">{r.year ?? ""}</p>
          </div>
          <span className={`text-sm font-semibold ${r.unanimous ? "text-yes" : ""}`}>
            {r.unanimous ? "alle ♥" : `${r.likes} ♥`}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Results({ state }: { state: RoomState }) {
  const winner = state.ranking.find((r) => r.tmdbId === state.winner) ?? state.ranking[0];
  return (
    <>
      {winner ? (
        <section className="card overflow-hidden p-0 text-center">
          {winner.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={winner.poster.replace("/w342/", "/w500/")} alt="" className="mx-auto max-h-96 w-full object-cover" />
          )}
          <div className="p-5">
            <p className="text-sm uppercase tracking-widest text-accent">Heute läuft</p>
            <h1 className="mt-1 text-3xl font-bold">{winner.title}</h1>
            <p className="mt-1 text-muted">
              {winner.unanimous ? "Alle haben Bock 🎉" : `${winner.likes} von ${state.participants.length} haben Bock`}
            </p>
          </div>
        </section>
      ) : (
        <section className="card text-center">Keiner hatte auf irgendwas Bock. Nächste Runde?</section>
      )}
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Komplette Rangliste</h2>
        <RankingList ranking={state.ranking} />
      </section>
      <Link href="/" className="btn-ghost">
        Neue Runde
      </Link>
    </>
  );
}
