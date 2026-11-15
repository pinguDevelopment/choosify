"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProviderPicker } from "@/components/ProviderPicker";
import { useT } from "@/components/I18nProvider";

type Tv = { token: string; providerIds: number[]; anySource: boolean };
type Info = { crew: { name: string } | null; tv: Tv | null };

export function FernseherClient() {
  const [info, setInfo] = useState<Info | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [anySource, setAnySource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const t = useT();

  useEffect(() => {
    api<Info>("/api/fernseher")
      .then((d) => {
        setOrigin(window.location.origin);
        setInfo(d);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function run(method: "PUT" | "POST" | "DELETE", body: object = {}) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ tv: Tv | null }>("/api/fernseher", { method, body });
      setInfo((i) => (i ? { ...i, tv: res.tv } : i));
      if (method === "PUT") setSaved(true);
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <p className="text-muted">{error ?? t.common.loading}</p>;
  if (!info.crew)
    return (
      <section className="card flex flex-col gap-3">
        <h2 className="text-3xl">{t.tvSetup.noCrewTitle}</h2>
        <p className="text-muted">{t.tvSetup.noCrewText}</p>
        <Link href="/" className="btn-primary text-center">
          {t.common.startRound}
        </Link>
      </section>
    );

  const link = info.tv ? `${origin}/tv#${info.tv.token}` : "";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t.tvSetup.crew(info.crew.name)}</p>
      <ProviderPicker
        // Neu laden, sobald gespeicherte Einstellungen da sind
        key={info.tv ? "tv" : "neu"}
        picked={picked}
        setPicked={setPicked}
        anySource={anySource}
        setAnySource={setAnySource}
        preset={info.tv ? { ids: info.tv.providerIds, other: info.tv.anySource } : undefined}
        onError={setError}
        title={t.tvSetup.providersTitle}
        hint={t.tvSetup.providersHint}
      />
      {error && <p className="text-sm text-no">{error}</p>}
      <button className="btn-primary" disabled={busy} onClick={() => run("PUT", { providerIds: picked, anySource })}>
        {busy ? t.tvSetup.saving : info.tv ? (saved ? t.tvSetup.saved : t.tvSetup.save) : t.tvSetup.setup}
      </button>

      {info.tv && (
        <section className="card flex flex-col gap-4">
          <h2 className="text-3xl">{t.tvSetup.linkTitle}</h2>
          <p className="text-sm text-muted">{t.tvSetup.linkHint}</p>
          <input className="input py-2.5 text-sm" readOnly value={link} aria-label={t.tvSetup.linkLabel} onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? t.common.copied : t.tvSetup.copy}
            </button>
            <a className="btn-ghost" href={link} target="_blank" rel="noopener">
              {t.tvSetup.open}
            </a>
          </div>
          <details className="text-sm text-muted">
            <summary className="cursor-pointer text-text">{t.tvSetup.haTitle}</summary>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
              {t.tvSetup.haSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2">{t.tvSetup.haNote}</p>
          </details>
          <div className="flex flex-col gap-2 border-t border-line/70 pt-4">
            <button type="button" className="text-left text-sm text-muted underline underline-offset-4" disabled={busy} onClick={() => run("POST")}>
              {t.tvSetup.regenerate}
            </button>
            <button type="button" className="text-left text-sm text-no underline underline-offset-4" disabled={busy} onClick={() => run("DELETE")}>
              {t.tvSetup.disable}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
