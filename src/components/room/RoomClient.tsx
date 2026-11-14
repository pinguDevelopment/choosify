"use client";
import Link from "next/link";
import { Brand, TicketCode } from "@/components/Brand";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RoomState } from "./types";
import { JoinForm } from "./JoinForm";
import { GenrePicker } from "./GenrePicker";
import { Lobby } from "./Lobby";
import { Swiper } from "./Swiper";
import { Results } from "./Results";

const POLL_MS = 2500;

export function RoomClient({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await api<RoomState>(`/api/rooms/${code}`));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [code]);

  // Live-Stand: regelmäßig abfragen, solange der Tab sichtbar ist.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- erster Abruf beim Öffnen
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  let body: React.ReactNode;
  if (!state) {
    body = error ? (
      <div className="card text-center">
        <h1 className="text-3xl">{error}</h1>
        <p className="mt-2 text-muted">Runden laufen nach 24 Stunden ab. Prüf den Code oder lass dir einen neuen Link schicken.</p>
        <Link href="/" className="btn-ghost mt-4">
          Zur Startseite
        </Link>
      </div>
    ) : (
      <p className="text-center text-muted">Lade Runde …</p>
    );
  } else if (!state.me) {
    body = <JoinForm code={code} status={state.status} onJoined={refresh} />;
  } else if (state.status === "lobby" && !state.me.genresDone) {
    body = (
      <>
        {state.me.isHost && <Lobby state={state} onChange={refresh} compact />}
        <GenrePicker code={code} initial={state.me.genreIds} onDone={refresh} />
      </>
    );
  } else if (state.status === "lobby") {
    body = <Lobby state={state} onChange={refresh} />;
  } else if (state.status === "voting") {
    body = <Swiper state={state} onChange={refresh} />;
  } else {
    body = <Results state={state} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between">
        <Brand />
        <TicketCode code={code} />
      </header>
      {body}
      {state && error && <p className="text-center text-sm text-no">{error}</p>}
    </main>
  );
}
