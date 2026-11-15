"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/I18nProvider";

export function JoinByCode() {
  const router = useRouter();
  const t = useT();
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
      <h2 className="text-3xl">{t.joinByCode.title}</h2>
      <p className="text-muted">{t.joinByCode.hint}</p>
      <div className="flex gap-2">
        <input
          className="input font-display text-xl font-extrabold tracking-[0.18em] uppercase"
          placeholder="K7QM2XH9TA"
          value={code}
          maxLength={12}
          onChange={(e) => setCode(e.target.value)}
          aria-label={t.common.roomCodeLabel}
        />
        <button className="btn-ghost" disabled={clean.length !== 10}>
          {t.joinByCode.join}
        </button>
      </div>
    </form>
  );
}
