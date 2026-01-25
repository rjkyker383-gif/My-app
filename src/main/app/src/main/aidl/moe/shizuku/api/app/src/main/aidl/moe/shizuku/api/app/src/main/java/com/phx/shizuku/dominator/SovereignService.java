package com.phx.shizuku.dominator;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.provider.Settings;
import rikka.shizuku.Shizuku;

public class SovereignService extends Service {
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            String setting = intent.getStringExtra("setting");
            String value = intent.getStringExtra("value");
            if (setting != null && value != null) {
                try {
                    Settings.Secure.putString(getContentResolver(), setting, value);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
