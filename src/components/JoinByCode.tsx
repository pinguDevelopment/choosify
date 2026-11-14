"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 10) router.push(`/r/${clean}`);
      }}
    >
      <h2 className="text-lg font-semibold">Einer Runde beitreten</h2>
      <p className="text-sm text-muted">Am einfachsten den QR-Code scannen. Oder den Code eintippen:</p>
      <div className="flex gap-2">
        <input
          className="input font-mono tracking-widest uppercase"
          placeholder="K7QM2XH9TA"
          value={code}
          maxLength={12}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Raum-Code"
        />
        <button className="btn-ghost" disabled={clean.length !== 10}>
          Los
        </button>
      </div>
    </form>
  );
}
