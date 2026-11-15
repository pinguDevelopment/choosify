"use client";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { RoomState } from "./types";
import { useT } from "@/components/I18nProvider";

const SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

/** Gleichstand vorne: jede Person tippt genau einen Film an, dann gibt es genau einen Gewinner. */
export function Runoff({ state, onChange }: { state: RoomState; onChange: () => void }) {
  const runoff = state.runoff!;
  const [pick, setPick] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const chosen = pick ?? runoff.myPick;
  const films = runoff.tmdbIds
    .map((id) => state.ranking.find((r) => r.tmdbId === id) ?? state.movies.find((m) => m.tmdbId === id))
    .filter((f) => f !== undefined);

  async function choose(tmdbId: number) {
    setPick(tmdbId);
    setError(null);
    navigator.vibrate?.(10);
    try {
      await api(`/api/rooms/${state.code}/runoff`, { body: { tmdbId } });
      onChange();
    } catch (e) {
      setError((e as Error).message);
      setPick(null);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="flex flex-col gap-2 text-center">
        <p className="text-lg text-muted">{t.runoff.tie}</p>
        <h1 className="text-[clamp(2.4rem,11vw,3.4rem)] leading-none">{t.runoff.title}</h1>
        <p className="text-muted">
          {t.runoff.hint(films.length)}
        </p>
      </section>

      <ul className="grid grid-cols-2 gap-3">
        {films.map((f, i) => {
          const active = chosen === f.tmdbId;
          return (
            <motion.li
              key={f.tmdbId}
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING, delay: i * 0.06 }}
            >
              <motion.button
                type="button"
                aria-pressed={active}
                aria-label={t.runoff.choose(f.title)}
                whileTap={{ scale: 0.95 }}
                animate={{ scale: active ? 1.02 : 1 }}
                transition={SPRING}
                onClick={() => choose(f.tmdbId)}
                className={`relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border-4 text-left shadow-[0_12px_28px_rgb(0_0_0/0.4)] transition-colors ${
                  active ? "border-accent" : "border-transparent"
                }`}
              >
                {f.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- TMDB liefert fertige Größen
                  <img src={f.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-surface-2" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a0509] via-[#1a0509]/30 to-transparent" />
                {active && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: -6 }}
                    transition={SPRING}
                    className="absolute top-3 left-3 rounded-md bg-accent px-2 py-0.5 font-display text-lg font-extrabold uppercase text-accent-ink"
                  >
                    {t.runoff.myPick}
                  </motion.span>
                )}
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block font-display text-xl leading-tight font-extrabold">{f.title}</span>
                  {f.year && <span className="text-sm text-muted">{f.year}</span>}
                </span>
              </motion.button>
            </motion.li>
          );
        })}
      </ul>
      {error && <p className="text-center text-sm text-no">{error}</p>}

      <section className="card flex flex-col gap-3 text-center">
        <p className="font-display text-2xl font-extrabold tabular-nums">
          {t.runoff.progress(runoff.votes, state.participants.length)}
        </p>
        <p className="text-sm text-muted">{t.runoff.secret}</p>
        {state.me?.isHost && (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/rooms/${state.code}/finish`, { body: {} });
                onChange();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {t.runoff.end}
          </button>
        )}
      </section>
    </MotionConfig>
  );
}
