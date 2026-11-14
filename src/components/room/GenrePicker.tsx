"use client";
import { useEffect, useState } from "react";
import { api, type Genre } from "@/lib/api";

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
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Worauf hast du Bock?</h2>
        <p className="mt-1 text-sm text-muted">Wähle so viele Genres, wie du willst. Gar keins heißt: mir egal.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {genres === null && !error && <p className="text-sm text-muted">Lade Genres …</p>}
        {genres?.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={picked.includes(g.id)} onClick={() => toggle(g.id)}>
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
