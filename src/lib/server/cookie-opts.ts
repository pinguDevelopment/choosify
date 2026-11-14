import "server-only";

const secure = process.env.NODE_ENV === "production";
/** Gemeinsame Cookie-Optionen: nur für den Server lesbar, nicht seitenübergreifend mitgeschickt. */
export const cookieBase = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
