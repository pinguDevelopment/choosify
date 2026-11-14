"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Movie, RoomState } from "./types";
import { RankingList } from "./Results";

const THRESHOLD = 110;

export function Swiper({ state, onChange }: { state: RoomState; onChange: () => void }) {
  // null = lokal zurückgenommen, bis der Server es bestätigt
  const [local, setLocal] = useState<Record<number, boolean | null>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const voted = useMemo<Record<number, boolean | null>>(() => ({ ...state.myVotes, ...local }), [state.myVotes, local]);
  const queue = state.movies.filter((m) => voted[m.tmdbId] == null);
  const done = state.movies.length - queue.length;

  async function cast(m: Movie, liked: boolean) {
    setLocal((l) => ({ ...l, [m.tmdbId]: liked })); // sofort weiter, Server im Hintergrund
    setHistory((h) => [...h, m.tmdbId]);
    navigator.vibrate?.(liked ? [12, 40, 12] : 12);
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: m.tmdbId, liked } });
    } catch (e) {
      setError((e as Error).message);
      setLocal((l) => {
        const n = { ...l };
        delete n[m.tmdbId];
        return n;
      });
    }
  }

  async function undo() {
    const last = history.at(-1);
    if (last === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setLocal((l) => ({ ...l, [last]: null }));
    try {
      await api(`/api/rooms/${state.code}/vote`, { body: { tmdbId: last, liked: null } });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Tastatur am Laptop: ← Nein, → Ja, Backspace = Rückgängig
  const top = queue[0];
  const castRef = useRef(cast);
  const undoRef = useRef(undo);
  useEffect(() => {
    castRef.current = cast;
    undoRef.current = undo;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" && top) castRef.current(top, true);
      else if (e.key === "ArrowLeft" && top) castRef.current(top, false);
      else if (e.key === "Backspace") undoRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top]);

  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(done / Math.max(1, state.movies.length)) * 100}%` }}
          />
        </div>
        <span>
          {done}/{state.movies.length}
        </span>
      </div>

      {queue.length > 0 ? (
        <>
          <div className="relative h-[min(68vh,560px)]">
            {queue
              .slice(0, 3)
              .reverse()
              .map((m, i, arr) => (
                <SwipeCard
                  key={m.tmdbId}
                  movie={m}
                  depth={arr.length - 1 - i}
                  onVote={(liked) => cast(m, liked)}
                />
              ))}
          </div>
          <div className="flex items-center justify-center gap-6">
            <button
              className="btn h-11 w-11 rounded-full border border-line bg-surface text-lg text-muted"
              aria-label="Rückgängig"
              title="Rückgängig"
              disabled={history.length === 0}
              onClick={undo}
            >
              ↺
            </button>
            <button
              className="btn h-16 w-16 rounded-full border border-no/50 bg-surface text-2xl text-no"
              aria-label="Nein"
              onClick={() => cast(queue[0], false)}
            >
              ✕
            </button>
            <button
              className="btn h-16 w-16 rounded-full border border-yes/50 bg-surface text-2xl text-yes"
              aria-label="Ja"
              onClick={() => cast(queue[0], true)}
            >
              ♥
            </button>
            <span className="w-11" aria-hidden />
          </div>
          <p className="hidden text-center text-xs text-muted sm:block">Tastatur: ← Nö · → Bock · ⌫ Rückgängig</p>
        </>
      ) : (
        <section className="card animate-pop text-center">
          <p className="text-2xl">🎉</p>
          <h2 className="mt-1 text-xl font-bold">Du bist durch!</h2>
          <p className="mt-1 text-sm text-muted">Hier der Zwischenstand, er aktualisiert sich live.</p>
        </section>
      )}
      {error && <p className="text-center text-sm text-no">{error}</p>}

      {(queue.length === 0 || state.me?.isHost) && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Fortschritt</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {state.participants.map((p) => (
              <li key={p.name} className="rounded-full bg-surface-2 px-3 py-1">
                {p.name} <span className="text-muted">{p.voted}/{state.movies.length}</span>
              </li>
            ))}
          </ul>
          {queue.length === 0 && <RankingList ranking={state.ranking.slice(0, 5)} />}
          {state.me?.isHost && <FinishButton state={state} onChange={onChange} />}
        </section>
      )}
    </>
  );
}

function FinishButton({ state, onChange }: { state: RoomState; onChange: () => void }) {
  const [addToAbspann, setAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = state.ranking[0];
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {top && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={addToAbspann} onChange={(e) => setAdd(e.target.checked)} className="accent-[var(--accent)]" />
          Gewinner danach in den Abspann (schon gesehen)
        </label>
      )}
      {error && <p className="text-sm text-no">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/rooms/${state.code}/finish`, {
              body: { winnerTmdbId: top?.tmdbId ?? null, addToAbspann: addToAbspann && !!top },
            });
            onChange();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Abstimmung beenden{top ? `: ${top.title}` : ""}
      </button>
    </div>
  );
}

function SwipeCard({ movie, depth, onVote }: { movie: Movie; depth: number; onVote: (liked: boolean) => void }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const top = depth === 0;

  const release = () => {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) > THRESHOLD) {
      const dir = dx > 0 ? 1 : -1;
      setLeaving(dir);
      setTimeout(() => onVote(dir === 1), 180);
    } else setDx(0);
  };

  const x = leaving ? leaving * 600 : dx;
  const hint = Math.max(-1, Math.min(1, dx / THRESHOLD));

  return (
    <article
      className="absolute inset-0 touch-none select-none overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      style={{
        transform: `translateX(${x}px) rotate(${x / 20}deg) scale(${1 - depth * 0.04}) translateY(${depth * 12}px)`,
        transition: dragging ? "none" : "transform 200ms ease-out",
        zIndex: 10 - depth,
      }}
      onPointerDown={(e) => {
        if (!top) return;
        start.current = e.clientX;
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {movie.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB liefert fertige Größen
        <img src={movie.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-surface-2 text-6xl">🎞️</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      {top && hint !== 0 && (
        <span
          className={`absolute top-6 rounded-xl border-4 px-3 py-1 text-2xl font-black uppercase ${
            hint > 0 ? "left-6 -rotate-12 border-yes text-yes" : "right-6 rotate-12 border-no text-no"
          }`}
          style={{ opacity: Math.abs(hint) }}
        >
          {hint > 0 ? "Bock" : "Nö"}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-2xl font-bold leading-tight">{movie.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {[movie.year, movie.rating != null ? `★ ${movie.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")}
        </p>
        {movie.overview && <p className="mt-2 line-clamp-4 text-sm text-text/85">{movie.overview}</p>}
      </div>
    </article>
  );
}
