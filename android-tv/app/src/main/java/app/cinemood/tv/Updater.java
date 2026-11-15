package app.cinemood.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Sucht auf GitHub (Release "tv-app") nach einer neuen Version der App und installiert sie auf Wunsch.
 *
 * Der Workflow legt neben der APK eine kleine Datei version.json ab:
 *   {"versionCode": 42, "versionName": "1.0.42", "apk": "https://…/cinemood-tv.apk"}
 * Ist versionCode größer als die installierte Version, fragt die App nach. Die Installation läuft über
 * den Paket-Installer von Android, der selbst noch einmal um Bestätigung bittet.
 */
final class Updater {
    private static final int TIMEOUT_MS = 15_000;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    /** Diese Version wurde in diesem App-Lauf mit „Später“ weggeklickt. */
    private static int skippedVersion;
    private static boolean busy;

    private Updater() {}

    private static final class Release {
        int versionCode;
        String versionName;
        String apk;
    }

    /**
     * @param manual true, wenn der Nutzer selbst auf „Nach Updates suchen“ gedrückt hat: Dann gibt es
     *               auch eine Meldung, wenn alles aktuell ist oder die Prüfung nicht geklappt hat.
     */
    static void check(Activity activity, boolean manual) {
        if (busy) return;
        busy = true;
        if (manual) Toast.makeText(activity, R.string.update_checking, Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            Release release = null;
            try {
                release = fetch();
            } catch (Exception ignored) {
                // Kein Internet oder GitHub nicht erreichbar: beim nächsten Start wieder versuchen
            }
            Release r = release;
            MAIN.post(() -> {
                busy = false;
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (r == null) {
                    if (manual) Toast.makeText(activity, R.string.update_failed, Toast.LENGTH_LONG).show();
                } else if (r.versionCode <= BuildConfig.VERSION_CODE) {
                    if (manual) {
                        Toast.makeText(activity, activity.getString(R.string.update_none, BuildConfig.VERSION_NAME),
                                Toast.LENGTH_LONG).show();
                    }
                } else if (manual || r.versionCode != skippedVersion) {
                    ask(activity, r);
                }
            });
        }, "cinemood-update-check").start();
    }

    private static Release fetch() throws Exception {
        HttpURLConnection con = open(BuildConfig.UPDATE_URL);
        try {
            if (con.getResponseCode() != 200) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = con.getInputStream()) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0 && out.size() < 64 * 1024) out.write(buf, 0, n);
            }
            JSONObject json = new JSONObject(out.toString("UTF-8"));
            Release r = new Release();
            r.versionCode = json.getInt("versionCode");
            r.versionName = json.optString("versionName", String.valueOf(r.versionCode));
            r.apk = json.getString("apk");
            // Nur von GitHub über https installieren
            if (!r.apk.startsWith("https://github.com/")) return null;
            return r;
        } finally {
            con.disconnect();
        }
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(TIMEOUT_MS);
        con.setReadTimeout(TIMEOUT_MS);
        con.setUseCaches(false);
        con.setInstanceFollowRedirects(true); // GitHub leitet Downloads auf seinen Speicher weiter
        con.setRequestProperty("User-Agent", "CinemoodTV/" + BuildConfig.VERSION_NAME);
        return con;
    }

    private static void ask(Activity activity, Release r) {
        new AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(R.string.update_title)
                .setMessage(activity.getString(R.string.update_text, r.versionName, BuildConfig.VERSION_NAME))
                .setPositiveButton(R.string.update_install, (d, w) -> install(activity, r))
                .setNegativeButton(R.string.update_later, (d, w) -> skippedVersion = r.versionCode)
                .setOnCancelListener(d -> skippedVersion = r.versionCode)
                .show();
    }

    private static void install(Activity activity, Release r) {
        // Ab Android 8 muss man der App einmal erlauben, Apps zu installieren
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            askForInstallPermission(activity);
            return;
        }
        AlertDialog progress = new AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(R.string.update_title)
                .setMessage(activity.getString(R.string.update_downloading, 0))
                .setCancelable(false)
                .show();
        busy = true;
        new Thread(() -> {
            boolean ok = false;
            try {
                download(activity, r, percent -> MAIN.post(() ->
                        progress.setMessage(activity.getString(R.string.update_downloading, percent))));
                ok = true;
            } catch (Exception ignored) {
                // Meldung unten
            }
            boolean success = ok;
            MAIN.post(() -> {
                busy = false;
                if (progress.isShowing()) {
                    try {
                        progress.dismiss();
                    } catch (IllegalArgumentException ignored) {
                        // Activity schon weg
                    }
                }
                if (!success) Toast.makeText(activity, R.string.update_download_failed, Toast.LENGTH_LONG).show();
                // Bei Erfolg zeigt Android jetzt die Rückfrage „Diese App aktualisieren?“ (InstallReceiver)
            });
        }, "cinemood-update-download").start();
    }

    private interface Progress {
        void update(int percent);
    }

    /** Lädt die APK direkt in eine Installations-Sitzung von Android und schickt sie ab. */
    private static void download(Activity activity, Release r, Progress progress) throws Exception {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);
        HttpURLConnection con = null;
        try {
            con = open(r.apk);
            if (con.getResponseCode() != 200) throw new IOException("HTTP " + con.getResponseCode());
            long total = con.getContentLength();
            try (InputStream in = con.getInputStream();
                 OutputStream out = session.openWrite("cinemood-tv.apk", 0, total > 0 ? total : -1)) {
                byte[] buf = new byte[64 * 1024];
                long done = 0;
                int lastPercent = -1;
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    if (total > 0) {
                        int percent = (int) (done * 100 / total);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            progress.update(percent);
                        }
                    }
                }
                session.fsync(out);
            }
            Intent result = new Intent(activity, InstallReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            // Der Installer schreibt das Ergebnis in den Intent, deshalb muss er veränderbar sein
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(activity, sessionId, result, flags);
            session.commit(pi.getIntentSender());
            session.close();
        } catch (Exception e) {
            session.abandon();
            throw e;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static void askForInstallPermission(Activity activity) {
        new AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(R.string.update_permission_title)
                .setMessage(R.string.update_permission_text)
                .setPositiveButton(R.string.update_permission_open, (d, w) -> {
                    try {
                        activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName())));
                    } catch (ActivityNotFoundException | SecurityException e) {
                        // Manche Fernseher (z. B. Fire TV) haben diese Seite nicht: Weg beschreiben
                        new AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                                .setTitle(R.string.update_permission_title)
                                .setMessage(R.string.update_permission_manual)
                                .setPositiveButton(android.R.string.ok, null)
                                .show();
                    }
                })
                .setNegativeButton(R.string.update_later, null)
                .show();
    }
}
