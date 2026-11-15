package app.cinemood.handy;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Menü der App: Server-Adresse ändern (eigene Domain, Server im Heimnetz), Seite neu laden,
 * nach Updates suchen.
 */
public class SettingsActivity extends Activity {
    /** Ergebnis an MainActivity: Seite frisch laden. */
    static final int RESULT_RELOAD = RESULT_FIRST_USER;

    private EditText input;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        input = findViewById(R.id.url);
        TextView hint = findViewById(R.id.hint);
        TextView version = findViewById(R.id.version);
        Button save = findViewById(R.id.save);
        Button reset = findViewById(R.id.reset);
        Button cancel = findViewById(R.id.cancel);
        Button reload = findViewById(R.id.reload);
        Button update = findViewById(R.id.check_update);

        input.setText(Prefs.baseUrl(this));
        input.setSelection(input.getText().length());
        hint.setText(getString(R.string.settings_hint, BuildConfig.DEFAULT_URL));
        version.setText(getString(R.string.settings_version, BuildConfig.VERSION_NAME));

        input.setOnEditorActionListener((v, actionId, event) -> {
            boolean enter = event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                    && event.getAction() == KeyEvent.ACTION_DOWN;
            if (actionId == EditorInfo.IME_ACTION_DONE || enter) {
                save();
                return true;
            }
            return false;
        });
        save.setOnClickListener(v -> save());
        reset.setOnClickListener(v -> {
            Prefs.reset(this);
            Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show();
            setResult(RESULT_RELOAD);
            finish();
        });
        cancel.setOnClickListener(v -> finish());
        reload.setOnClickListener(v -> {
            setResult(RESULT_RELOAD);
            finish();
        });
        update.setOnClickListener(v -> Updater.check(this, true));
    }

    private void save() {
        String url = Prefs.normalize(input.getText().toString());
        if (url == null) {
            input.setError(getString(R.string.settings_invalid));
            return;
        }
        Prefs.setBaseUrl(this, url);
        Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show();
        // Immer frisch laden, auch wenn die Adresse gleich geblieben ist
        setResult(RESULT_RELOAD);
        finish();
    }
}
