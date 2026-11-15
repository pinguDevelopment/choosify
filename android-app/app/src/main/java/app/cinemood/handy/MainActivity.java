package app.cinemood.handy;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * Cinemood als App fürs Handy: zeigt die Web-App (Runde erstellen, beitreten, abstimmen) in einer WebView.
 *
 * Anmeldung mit Google: Google lässt die Anmeldung nicht in einer WebView zu. Tippt man in der App auf
 * „Mit Google anmelden“, öffnet die App die Anmeldung deshalb im Browser (als Custom Tab, sieht aus wie
 * ein Teil der App). Danach springt der Browser über cinemood://anmelden?ticket=… zurück, und die App
 * löst das Ticket zusammen mit ihrem Einmal-Geheimnis beim Server ein. So landet die Anmeldung in der App.
 *
 * QR-Codes der Runden (https://…/r/CODE) öffnen direkt in der App, wenn sie installiert ist.
 * Einstellungen (Server-Adresse, Updates): App-Symbol lange drücken.
 */
public class MainActivity extends Activity {
    private static final long RETRY_MS = 10_000;
    /** Kommt die Seite so lange nicht fertig, gilt sie als hängengeblieben. */
    private static final long LOAD_TIMEOUT_MS = 30_000;
    /** Update-Prüfung kurz nach dem Start, damit erst die Seite lädt. */
    private static final long UPDATE_DELAY_MS = 8_000;
    private static final int REQUEST_SETTINGS = 1;
    private static final String LOGIN_PATH = "/api/auth/google";

    /** Teilen-Menü von Android für navigator.share (gibt es in der WebView sonst nicht). */
    private static final String SHARE_POLYFILL =
            "(function(){if(navigator.share||!window.CinemoodNative)return;"
                    + "navigator.share=function(d){d=d||{};CinemoodNative.share(String(d.url||''),String(d.title||''),String(d.text||''));"
                    + "return Promise.resolve();};})();";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retry = this::reload;
    private final Runnable loadTimeout = () -> showError(getString(R.string.error_timeout));
    private final Runnable updateCheck = () -> Updater.check(this, false);

    private WebView web;
    private View errorView;
    private TextView errorText;
    private String loadedBase;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.web);
        errorView = findViewById(R.id.error);
        errorText = findViewById(R.id.error_text);
        Button retryButton = findViewById(R.id.error_retry);
        Button settingsButton = findViewById(R.id.error_settings);
        retryButton.setOnClickListener(v -> reload());
        settingsButton.setOnClickListener(v -> openSettings());

        setupWebView();
        if (!handleIntent(getIntent())) load(Prefs.homeUrl(this));
        handler.postDelayed(updateCheck, UPDATE_DELAY_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** QR-Code-Link oder Rücksprung von der Google-Anmeldung. true, wenn etwas geladen wurde. */
    private boolean handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri uri = intent.getData();
        if (uri == null) return false;
        if ("cinemood".equals(uri.getScheme())) {
            finishGoogleLogin(uri);
            return true;
        }
        if (sameServer(uri)) {
            load(uri.toString());
            return true;
        }
        return false;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupWebView() {
        web.setBackgroundColor(Color.parseColor("#2a0a14"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // Lieblingsdienste, Einführung usw. liegen im localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        // Kennzeichen für den Server: Hier ist die Handy-App (u. a. für die Google-Anmeldung)
        s.setUserAgentString(s.getUserAgentString() + " CinemoodApp/" + BuildConfig.VERSION_NAME);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        // Nur für eigene Seiten: Fremde Adressen öffnen immer im Browser, nie in dieser WebView.
        web.addJavascriptInterface(new NativeBridge(), "CinemoodNative");
        web.setWebViewClient(new Client());
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        // Adresse wurde in den Einstellungen geändert
        if (loadedBase != null && !loadedBase.equals(Prefs.baseUrl(this))) load(Prefs.homeUrl(this));
    }

    @Override
    protected void onPause() {
        web.onPause();
        web.pauseTimers();
        // Anmelde-Cookie sofort speichern, falls Android die App im Hintergrund beendet
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SETTINGS && resultCode == SettingsActivity.RESULT_RELOAD) load(Prefs.homeUrl(this));
    }

    private void load(String url) {
        loadedBase = Prefs.baseUrl(this);
        armLoad();
        web.loadUrl(url);
    }

    private void armLoad() {
        handler.removeCallbacks(retry);
        handler.removeCallbacks(loadTimeout);
        handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
        mainFrameFailed = false;
        errorView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
    }

    private void reload() {
        String current = web.getUrl();
        if (current == null || mainFrameFailed) load(current != null && sameServer(Uri.parse(current)) ? current : Prefs.homeUrl(this));
        else {
            armLoad();
            web.reload();
        }
    }

    private void showError(String detail) {
        handler.removeCallbacks(loadTimeout);
        mainFrameFailed = true;
        errorText.setText(getString(R.string.error_text, Prefs.baseUrl(this), detail));
        errorView.setVisibility(View.VISIBLE);
        web.setVisibility(View.INVISIBLE);
        // Nach einem WLAN-Wackler von selbst weitermachen
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    private void openSettings() {
        startActivityForResult(new Intent(this, SettingsActivity.class), REQUEST_SETTINGS);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (errorView.getVisibility() != View.VISIBLE && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    // ---- Google-Anmeldung ---------------------------------------------------

    /** Öffnet die Anmeldung im Browser. Der Server bekommt nur den Hash des Geheimnisses. */
    private void startGoogleLogin(Uri loginUri) {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        String secret = base64Url(raw);
        String hash;
        try {
            hash = base64Url(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            Toast.makeText(this, R.string.login_failed, Toast.LENGTH_LONG).show();
            return;
        }
        Prefs.setLoginSecret(this, secret);
        Uri url = loginUri.buildUpon().clearQuery()
                .appendQueryParameter("next", "/konto")
                .appendQueryParameter("app", hash)
                .build();
        Intent intent = new Intent(Intent.ACTION_VIEW, url);
        // Als Custom Tab öffnen (Chrome, Samsung Internet u. a.), ohne Zusatzbibliothek:
        // Ein leerer Session-Eintrag reicht dem Browser als Zeichen dafür.
        Bundle extras = new Bundle();
        extras.putBinder("android.support.customtabs.extra.SESSION", null);
        intent.putExtras(extras);
        intent.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR", Color.parseColor("#2a0a14"));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.login_no_browser, Toast.LENGTH_LONG).show();
        }
    }

    /** Rücksprung aus dem Browser: Ticket in der WebView einlösen, dann ist man in der App angemeldet. */
    private void finishGoogleLogin(Uri uri) {
        String secret = Prefs.takeLoginSecret(this);
        String ticket = uri.getQueryParameter("ticket");
        if (secret == null || ticket == null || ticket.isEmpty()) {
            Toast.makeText(this, R.string.login_failed, Toast.LENGTH_LONG).show();
            if (web.getUrl() == null) load(Prefs.homeUrl(this));
            return;
        }
        try {
            String body = "ticket=" + URLEncoder.encode(ticket, "UTF-8") + "&secret=" + URLEncoder.encode(secret, "UTF-8");
            loadedBase = Prefs.baseUrl(this);
            armLoad();
            web.postUrl(Prefs.baseUrl(this) + "/api/auth/app", body.getBytes(StandardCharsets.UTF_8));
        } catch (UnsupportedEncodingException e) {
            Toast.makeText(this, R.string.login_failed, Toast.LENGTH_LONG).show();
        }
    }

    private static String base64Url(byte[] b) {
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    // ---- Links --------------------------------------------------------------

    private boolean sameServer(Uri uri) {
        Uri base = Uri.parse(Prefs.baseUrl(this));
        return uri.getHost() != null && uri.getHost().equalsIgnoreCase(base.getHost())
                && uri.getPort() == base.getPort()
                && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()));
    }

    /** true = die WebView lädt die Adresse nicht selbst. */
    private boolean route(Uri uri) {
        if (sameServer(uri)) {
            if (LOGIN_PATH.equals(uri.getPath())) {
                startGoogleLogin(uri);
                return true;
            }
            return false;
        }
        // Fremde Seiten (Trailer, IMDb, …) und andere Apps (WhatsApp, Mail) außerhalb der App öffnen
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException ignored) {
            // Nichts installiert, das den Link öffnen kann
        }
        return true;
    }

    /** Für die Webseite erreichbar als window.CinemoodNative. */
    private class NativeBridge {
        @JavascriptInterface
        public void share(String url, String title, String text) {
            runOnUiThread(() -> {
                String content = text.isEmpty() ? url : (url.isEmpty() ? text : text + "\n" + url);
                if (content.isEmpty()) return;
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, content);
                if (!title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
                try {
                    startActivity(Intent.createChooser(send, title.isEmpty() ? null : title));
                } catch (ActivityNotFoundException ignored) {
                    // Kein Teilen möglich
                }
            });
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return route(request.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return route(Uri.parse(url));
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            handler.removeCallbacks(loadTimeout);
            if (url != null && sameServer(Uri.parse(url))) view.evaluateJavascript(SHARE_POLYFILL, null);
            if (!mainFrameFailed) {
                errorView.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
        }

        /**
         * Der Teil von Android, der die Seite darstellt, ist abgestürzt oder wurde wegen Speichermangel
         * beendet. Ohne diese Methode beendet Android die ganze App. Wir bauen die Ansicht einfach neu auf.
         */
        @TargetApi(Build.VERSION_CODES.O)
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            handler.removeCallbacksAndMessages(null);
            recreate();
            return true;
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                showError("HTTP " + response.getStatusCode());
            }
        }
    }
}
