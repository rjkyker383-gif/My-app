package com.phx.shizuku.dominator

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import timber.log.Timber

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Timber.d("Boot completed, PHX Shizuku Dominator is here.")
            val workRequest = OneTimeWorkRequestBuilder<ShizukuWorker>()
                .setInputData(Data.Builder()
                    .putString("key", "some.boot.prop")
                    .putString("value", "true")
                    .build())
                .build()
            WorkManager.getInstance(context).enqueue(workRequest)
        }
    }
}
