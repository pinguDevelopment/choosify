package app.cinemood.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Zeigt die Fernseher-Seite von Cinemood (/tv) im Vollbild.
 * Am Fernseher muss man nichts bedienen: Die Seite zeigt einen Code, der Host gibt ihn am Handy ein.
 *
 * Fernbedienung:
 *  - Menü-Taste oder OK lange gedrückt halten: Server-Adresse ändern
 *  - Zurück: zweimal drücken beendet die App
 */
public class MainActivity extends Activity {
    private static final long RETRY_MS = 10_000;
    private static final long BACK_EXIT_MS = 2_000;
    private static final long LONG_PRESS_MS = 1_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retry = this::reload;

    private WebView web;
    private View errorView;
    private TextView errorText;
    private String loadedUrl;
    private boolean mainFrameFailed;
    private long lastBack;
    private boolean longPressHandled;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Bildschirm bleibt an, solange die App vorne ist (kein Bildschirmschoner mitten in der Runde)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.web);
        errorView = findViewById(R.id.error);
        errorText = findViewById(R.id.error_text);
        Button retryButton = findViewById(R.id.error_retry);
        Button settingsButton = findViewById(R.id.error_settings);
        retryButton.setOnClickListener(v -> reload());
        settingsButton.setOnClickListener(v -> openSettings());

        web.setBackgroundColor(Color.parseColor("#2a0a14"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // der Kopplungs-Code liegt im localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString(s.getUserAgentString() + " CinemoodTV/" + BuildConfig.VERSION_NAME);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        web.setWebViewClient(new Client());

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
            loadedUrl = Prefs.tvUrl(this);
        } else {
            load();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        web.onResume();
        web.resumeTimers();
        // Adresse wurde in den Einstellungen geändert
        if (loadedUrl != null && !loadedUrl.equals(Prefs.tvUrl(this))) load();
    }

    @Override
    protected void onPause() {
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void load() {
        loadedUrl = Prefs.tvUrl(this);
        handler.removeCallbacks(retry);
        mainFrameFailed = false;
        errorView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        web.loadUrl(loadedUrl);
    }

    private void reload() {
        String current = web.getUrl();
        if (current == null || mainFrameFailed) load();
        else {
            mainFrameFailed = false;
            web.reload();
        }
    }

    private void showError(String detail) {
        mainFrameFailed = true;
        errorText.setText(getString(R.string.error_text, Prefs.baseUrl(this), detail));
        errorView.setVisibility(View.VISIBLE);
        web.setVisibility(View.INVISIBLE);
        findViewById(R.id.error_retry).requestFocus();
        // Nach Stromausfall oder WLAN-Wackler von selbst weitermachen
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    private void openSettings() {
        startActivity(new Intent(this, SettingsActivity.class));
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    /**
     * Tasten abfangen, bevor die Webseite sie bekommt: Die WebView schluckt OK sonst selbst.
     * OK etwa eine Sekunde halten öffnet die Einstellungen, kurz drücken geht an die Seite.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_MENU || code == KeyEvent.KEYCODE_SETTINGS) {
            if (event.getAction() == KeyEvent.ACTION_UP) openSettings();
            return true;
        }
        if (isOk(code)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                longPressHandled = false;
            }
            if (event.getAction() == KeyEvent.ACTION_DOWN && !longPressHandled
                    && event.getEventTime() - event.getDownTime() >= LONG_PRESS_MS) {
                longPressHandled = true;
                openSettings();
                return true;
            }
            if (longPressHandled) return true; // restliche Wiederholungen und Loslassen schlucken
        }
        return super.dispatchKeyEvent(event);
    }

    private static boolean isOk(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER;
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (errorView.getVisibility() != View.VISIBLE && web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBack < BACK_EXIT_MS) {
            super.onBackPressed();
        } else {
            lastBack = now;
            Toast.makeText(this, R.string.back_again, Toast.LENGTH_SHORT).show();
        }
    }

    private class Client extends WebViewClient {
        /** Nur die eigene Seite im Fernseher öffnen, fremde Links (Trailer usw.) ignorieren. */
        private boolean sameServer(Uri uri) {
            Uri base = Uri.parse(Prefs.baseUrl(MainActivity.this));
            return uri.getHost() != null && uri.getHost().equalsIgnoreCase(base.getHost())
                    && uri.getPort() == base.getPort();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !sameServer(request.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !sameServer(Uri.parse(url));
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!mainFrameFailed) {
                errorView.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
                web.requestFocus();
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                showError(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? String.valueOf(error.getDescription()) : "");
            }
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // Für Android 5 (dort gibt es die neue Variante oben noch nicht)
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) showError(description);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                showError("HTTP " + response.getStatusCode());
            }
        }
    }
}
