package com.example.phxshizukudominator

import android.content.*
import androidx.work.*
import java.util.concurrent.TimeUnit
import timber.log.Timber

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Timber.d("BootReceiver received intent: %s", intent?.action)
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            Timber.d("Scheduling periodic ShizukuWorker after boot")
            val request = PeriodicWorkRequestBuilder<ShizukuWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "shizuku_task", ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}
