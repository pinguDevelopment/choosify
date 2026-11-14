import "server-only";

/** Erwartbarer Fehler, dessen Text dem Nutzer angezeigt werden darf. */
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Einheitliche Fehlerantwort ohne interne Details (keine Stacktraces an Clients). */
export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * Fehlercodes, wenn die Datenbank älter ist als der Code (Update-SQL nicht ausgeführt
 * oder Schema-Cache von PostgREST nicht neu geladen): Spalte, Tabelle oder Funktion fehlt.
 */
const OUTDATED_SCHEMA = new Set(["PGRST202", "PGRST204", "PGRST205", "42703", "42P01", "42883"]);

export function isOutdatedSchema(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && OUTDATED_SCHEMA.has(code);
}

export function serverError(err: unknown) {
  if (isOutdatedSchema(err)) {
    const e = err as { code: string; message?: string };
    console.error(
      `Datenbank ist nicht aktuell (${e.code}: ${e.message ?? ""}). ` +
        "Führe die fehlenden SQL-Updates aus supabase/ im Supabase SQL Editor aus.",
    );
    return jsonError(503, "Die Datenbank ist noch nicht auf dem neuesten Stand. Der Host muss die SQL-Updates einspielen.");
  }
  console.error(err);
  return jsonError(500, "Interner Fehler");
}

/** Fängt AppError (erwartbare Fehler mit Status) und alles andere als 500 ab. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return jsonError(err.status, err.message);
    return serverError(err);
  }
}
