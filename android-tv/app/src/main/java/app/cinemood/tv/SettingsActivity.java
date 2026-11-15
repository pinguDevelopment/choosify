package app.cinemood.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/** Server-Adresse ändern, z. B. für eine eigene Domain oder einen Server im Heimnetz. */
public class SettingsActivity extends Activity {
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
            finish();
        });
        cancel.setOnClickListener(v -> finish());
    }

    private void save() {
        String url = Prefs.normalize(input.getText().toString());
        if (url == null) {
            input.setError(getString(R.string.settings_invalid));
            return;
        }
        Prefs.setBaseUrl(this, url);
        Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show();
        finish();
    }
}
