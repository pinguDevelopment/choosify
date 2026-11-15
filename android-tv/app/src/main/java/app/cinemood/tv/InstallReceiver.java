package app.cinemood.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/**
 * Bekommt das Ergebnis der Update-Installation von Android.
 * Meist heißt das zuerst „Nutzer muss bestätigen“: Dann zeigen wir die Rückfrage des Paket-Installers.
 */
public class InstallReceiver extends BroadcastReceiver {
    @SuppressWarnings("deprecation")
    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(confirm);
                } catch (RuntimeException e) {
                    Toast.makeText(context, R.string.update_download_failed, Toast.LENGTH_LONG).show();
                }
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS && status != PackageInstaller.STATUS_FAILURE_ABORTED) {
            // Abgebrochen ist kein Fehler (Nutzer hat „Abbrechen“ gedrückt)
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Toast.makeText(context, context.getString(R.string.update_install_failed, msg != null ? msg : ""),
                    Toast.LENGTH_LONG).show();
        }
    }
}
