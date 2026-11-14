// Dienste-Favoriten im Browser (localStorage). Mit Konto liegen sie zusätzlich auf dem Server.
export const FAV_KEY = "choosify:lieblingsquellen";
export type Favorites = { ids: number[]; other: boolean };

export function loadLocalFavorites(): Favorites {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? "null");
    if (v && Array.isArray(v.ids)) {
      return { ids: v.ids.filter((x: unknown) => Number.isInteger(x) && (x as number) > 0).slice(0, 60), other: v.other === true };
    }
  } catch {
    // Speicher gesperrt oder kaputt: ohne Favoriten weiter
  }
  return { ids: [], other: false };
}

export function saveLocalFavorites(f: Favorites) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {
    // nicht schlimm, dann eben nur für diese Sitzung
  }
}
