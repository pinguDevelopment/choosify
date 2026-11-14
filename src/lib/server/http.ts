import "server-only";

/** Einheitliche Fehlerantwort ohne interne Details (keine Stacktraces an Clients). */
export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export function serverError(err: unknown) {
  console.error(err);
  return jsonError(500, "Interner Fehler");
}
