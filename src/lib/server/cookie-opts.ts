import "server-only";

// ALLOW_HTTP=1: Self-Hosting ohne HTTPS (im Heimnetz), sonst würde der Browser die Cookies verwerfen.
const secure = process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "1";
/** Gemeinsame Cookie-Optionen: nur für den Server lesbar, nicht seitenübergreifend mitgeschickt. */
export const cookieBase = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
