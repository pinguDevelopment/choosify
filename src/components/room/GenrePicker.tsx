"use client";
import { useEffect, useState } from "react";
import { api, type Genre } from "@/lib/api";

const EMOJI: Record<number, string> = {
  28: "💥", 12: "🧭", 16: "🎨", 35: "😂", 80: "🕵️", 99: "📚", 18: "🎭", 10751: "👨‍👩‍👧",
  14: "🧙", 36: "🏛️", 27: "👻", 10402: "🎵", 9648: "🔍", 10749: "💘", 878: "🚀",
  10770: "📺", 53: "😱", 10752: "🪖", 37: "🤠",
};

export function GenrePicker({ code, initial, onDone }: { code: string; initial: number[]; onDone: () => void }) {
  const [genres, setGenres] = useState<Genre[] | null>(null);
  const [picked, setPicked] = useState<number[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ genres: Genre[] }>("/api/tmdb/genres")
      .then((d) => setGenres(d.genres))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-4xl">Worauf hast du Bock?</h2>
        <p className="mt-2 text-muted">Wähl so viele Genres, wie du willst. Gar keins heißt: mir egal.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {genres === null && !error && Array.from({ length: 10 }, (_, i) => <span key={i} className="h-9 w-24 animate-pulse rounded-full bg-surface-2" />)}
        {genres?.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={picked.includes(g.id)} onClick={() => toggle(g.id)}>
            {EMOJI[g.id] ? `${EMOJI[g.id]} ` : ""}
            {g.name}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-no">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/rooms/${code}/genres`, { body: { genreIds: picked } });
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {picked.length ? `Weiter mit ${picked.length} Genre${picked.length > 1 ? "s" : ""}` : "Mir ist alles recht"}
      </button>
    </section>
  );
}
