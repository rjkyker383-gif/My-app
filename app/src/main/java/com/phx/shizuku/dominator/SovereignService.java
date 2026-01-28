package com.phx.shizuku.dominator;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.provider.Settings;

import rikka.shizuku.Shizuku;
import timber.log.Timber; // Import Timber

public class SovereignService extends Service {
    private static final String TAG = "SovereignService"; // Define TAG for Timber

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            // EXECUTE SECURE SETTING INJECTION
            String setting = intent.getStringExtra("setting");
            String value = intent.getStringExtra("value");
            if (setting != null && value != null) {
                try {
                    Settings.Secure.putString(getContentResolver(), setting, value);
                    Timber.d("Injected secure setting: %s with value %s", setting, value); // Log success
                } catch (Exception e) {
                    Timber.e(e, "Failed to inject secure setting: %s with value %s", setting, value); // Use Timber for error logging
                }
            } else {
                Timber.w("Received null setting or value in intent for secure setting injection."); // Log warning for null intent extras
            }
        } else {
            Timber.w("Shizuku permission not granted for SovereignService."); // Log warning if permission not granted
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
