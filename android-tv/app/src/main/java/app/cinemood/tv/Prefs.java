package app.cinemood.tv;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

/** Gespeicherte Server-Adresse, z. B. https://cinemood.yugusaa.de (ohne /tv am Ende). */
final class Prefs {
    private static final String FILE = "cinemood";
    private static final String KEY_URL = "base_url";

    private Prefs() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    static String baseUrl(Context c) {
        String saved = prefs(c).getString(KEY_URL, null);
        if (saved != null) return saved;
        String fallback = BuildConfig.DEFAULT_URL;
        // Mit eigener Adresse gebaut: merken, damit ein späteres Update (mit der offiziellen
        // Standard-Adresse) sie nicht überschreibt.
        if (BuildConfig.CUSTOM_DEFAULT) {
            String normalized = normalize(fallback);
            if (normalized != null) {
                setBaseUrl(c, normalized);
                return normalized;
            }
        }
        return fallback;
    }

    /** commit() statt apply(): sofort auf die Platte, auch wenn die App direkt danach beendet wird. */
    static void setBaseUrl(Context c, String url) {
        prefs(c).edit().putString(KEY_URL, url).commit();
    }

    static void reset(Context c) {
        prefs(c).edit().remove(KEY_URL).commit();
    }

    /** Die Seite, die der Fernseher anzeigt. */
    static String tvUrl(Context c) {
        return baseUrl(c) + "/tv";
    }

    /**
     * Macht aus einer Eingabe wie "film.example.de/tv/" eine saubere Adresse
     * ("https://film.example.de"). Gibt null zurück, wenn es keine gültige Adresse ist.
     */
    static String normalize(String input) {
        if (input == null) return null;
        String s = input.trim();
        if (s.isEmpty()) return null;
        if (!s.matches("(?i)^https?://.*")) s = "https://" + s;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (s.toLowerCase().endsWith("/tv")) s = s.substring(0, s.length() - 3);
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        Uri uri = Uri.parse(s);
        String host = uri.getHost();
        if (host == null || host.isEmpty() || host.contains(" ")) return null;
        return s;
    }
}
