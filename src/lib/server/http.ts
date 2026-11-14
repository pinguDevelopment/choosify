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

export function serverError(err: unknown) {
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
