// Kleiner Client-Helfer für die eigene API.
export async function api<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler ${res.status}`);
  return data as T;
}

export type Genre = { id: number; name: string };
export type Provider = { id: number; name: string; logoPath: string | null; featured: boolean };

export type AccountInfo = {
  email: string;
  favorites: { ids: number[]; other: boolean };
  crews: { id: string; name: string; active: boolean }[];
  deviceCrew: { name: string } | null;
};
