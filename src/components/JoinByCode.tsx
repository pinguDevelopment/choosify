"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return (
    <form
      className="flex flex-col gap-3 border-t-2 border-dashed border-line pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 10) router.push(`/r/${clean}`);
      }}
    >
      <h2 className="text-3xl">Eingeladen worden?</h2>
      <p className="text-muted">Scann den QR-Code beim Host oder tipp den Code von der Karte ab.</p>
      <div className="flex gap-2">
        <input
          className="input font-display text-xl font-extrabold tracking-[0.18em] uppercase"
          placeholder="K7QM2XH9TA"
          value={code}
          maxLength={12}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Raum-Code"
        />
        <button className="btn-ghost" disabled={clean.length !== 10}>
          Beitreten
        </button>
      </div>
    </form>
  );
}
