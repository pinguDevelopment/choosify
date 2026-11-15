package app.cinemood.handy;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

/** Gespeicherte Server-Adresse, z. B. https://cinemood.yugusaa.de, und das Geheimnis einer laufenden Google-Anmeldung. */
final class Prefs {
    private static final String FILE = "cinemood";
    private static final String KEY_URL = "base_url";
    private static final String KEY_LOGIN_SECRET = "login_secret";
    private static final String KEY_LOGIN_TIME = "login_time";
    /** So lange darf eine Google-Anmeldung im Browser dauern. */
    private static final long LOGIN_MAX_MS = 15 * 60 * 1000;

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

    /** Startseite der App. */
    static String homeUrl(Context c) {
        return baseUrl(c) + "/";
    }

    /**
     * Geheimnis für die laufende Google-Anmeldung. Liegt auf der Platte, weil Android die App
     * beenden kann, während die Anmeldung im Browser läuft.
     */
    static void setLoginSecret(Context c, String secret) {
        prefs(c).edit().putString(KEY_LOGIN_SECRET, secret).putLong(KEY_LOGIN_TIME, System.currentTimeMillis()).commit();
    }

    /** Holt das Geheimnis und löscht es (gilt nur einmal). null, wenn keins da oder zu alt. */
    static String takeLoginSecret(Context c) {
        SharedPreferences p = prefs(c);
        String secret = p.getString(KEY_LOGIN_SECRET, null);
        long time = p.getLong(KEY_LOGIN_TIME, 0);
        p.edit().remove(KEY_LOGIN_SECRET).remove(KEY_LOGIN_TIME).commit();
        if (secret == null || System.currentTimeMillis() - time > LOGIN_MAX_MS) return null;
        return secret;
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
