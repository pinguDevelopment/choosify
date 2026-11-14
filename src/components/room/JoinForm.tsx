"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function JoinForm({ code, status, onJoined }: { code: string; status: string; onJoined: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "done") {
    return <div className="card text-center">Diese Runde ist schon vorbei.</div>;
  }

  return (
    <form
      className="card flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/rooms/${code}/join`, { body: { name } });
          onJoined();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-2xl font-bold">Du wurdest eingeladen 🍿</h1>
        <p className="mt-1 text-muted">Wie sollen dich die anderen sehen?</p>
      </div>
      <input
        className="input"
        value={name}
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        placeholder="Dein Name"
        autoFocus
        required
      />
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Trete bei …" : "Beitreten"}
      </button>
    </form>
  );
}
