package com.example.phxshizukudominator

import android.content.*
import androidx.work.*

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val request = PeriodicWorkRequestBuilder<ShizukuWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "shizuku_task", ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}