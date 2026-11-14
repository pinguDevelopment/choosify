"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Entry = { tmdbId: number; title: string; poster: string | null; year: number | null };
type Hit = { tmdbId: number; title: string; poster: string | null; year: number | null };

export function AbspannClient() {
  const [data, setData] = useState<{ crew: { name: string } | null; movies: Entry[] } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ crew: { name: string } | null; movies: Entry[] }>("/api/abspann").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // Suche mit kleiner Verzögerung, damit nicht jeder Tastendruck eine Anfrage auslöst.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      api<{ results: Hit[] }>(`/api/tmdb/search?q=${encodeURIComponent(q)}`)
        .then((d) => setHits(d.results))
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!data) return <p className="text-muted">{error ?? "Lade …"}</p>;
  if (!data.crew) {
    return (
      <div className="card">
        <h2 className="text-3xl">Noch keine Crew</h2>
        <p className="mt-2 text-muted">Deine Crew entsteht, sobald du als Host die erste Runde startest. Danach landen eure Filme hier.</p>
        <Link href="/" className="btn-primary mt-4">
          Runde starten
        </Link>
      </div>
    );
  }

  const known = new Set(data.movies.map((m) => m.tmdbId));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Film eintragen</h2>
        <input className="input" placeholder="Titel suchen …" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim().length >= 2 && hits.length > 0 && (
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={h.tmdbId}>
                <button
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface disabled:opacity-50"
                  disabled={known.has(h.tmdbId)}
                  onClick={async () => {
                    try {
                      await api("/api/abspann", { body: { tmdbId: h.tmdbId } });
                      setQuery("");
                      setHits([]);
                      load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Thumb src={h.poster} />
                  <span className="flex-1">
                    {h.title} <span className="text-muted">{h.year ?? ""}</span>
                  </span>
                  <span className="pr-2 text-accent">{known.has(h.tmdbId) ? "schon drin" : "Eintragen"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">
          {data.crew.name} <span className="text-muted">({data.movies.length})</span>
        </h2>
        {data.movies.length === 0 && <p className="text-muted">Noch leer. Nach eurem ersten Filmabend steht hier der Gewinner.</p>}
        <ul className="flex flex-col gap-2">
          {data.movies.map((m) => (
            <li key={m.tmdbId} className="flex items-center gap-3 rounded-xl bg-surface p-2 pr-3">
              <Thumb src={m.poster} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{m.title}</span>
                <span className="text-sm text-muted">{m.year ?? "Jahr unbekannt"}</span>
              </span>
              <button
                className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-no hover:text-no"
                aria-label={`${m.title} entfernen`}
                onClick={async () => {
                  try {
                    await api("/api/abspann", { method: "DELETE", body: { tmdbId: m.tmdbId } });
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="text-center text-sm text-no">{error}</p>}
    </>
  );
}

function Thumb({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-14 w-10 rounded-md object-cover" />
  ) : (
    <div className="h-14 w-10 rounded-md bg-surface-2" />
  );
}
