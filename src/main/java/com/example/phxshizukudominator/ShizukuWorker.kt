package com.example.phxshizukudominator

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.AppOpsManager
import android.content.Context
import android.os.Binder
import androidx.core.app.NotificationCompat
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rikka.shizuku.Shizuku
import timber.log.Timber

class ShizukuWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    companion object {
        private const val NOTIF_CHANNEL_ID = "phx_shizuku_worker_channel"
        private const val NOTIF_ID = 1337
    }

    override suspend fun doWork(): Result {
        Timber.d("ShizukuWorker started")
        // Promote to foreground to avoid background-start restrictions on Android 12+
        setForegroundAsync(createForegroundInfo("Applying WRITE_SECURE_SETTINGS..."))

        return try {
            if (!Shizuku.pingBinder()) {
                Timber.w("Shizuku binder not available; will retry")
                saveStatus("SHIZUKU_UNAVAILABLE")
                return Result.retry()
            }
            val pkg = applicationContext.packageName
            val cmd = "pm grant $pkg android.permission.WRITE_SECURE_SETTINGS"
            Timber.d("Attempting to grant WRITE_SECURE_SETTINGS to %s via Shizuku", pkg)
            val result = withContext(Dispatchers.IO) { ShellCommander.runCommand(cmd) }
            Timber.d("pm grant result: %s", result)
            // After running pm grant, check AppOps if we can detect permission
            val granted = hasWriteSecureSettings()
            saveStatus(if (granted) "GRANTED" else "GRANT_ATTEMPTED: $result")
            if (granted) {
                Timber.i("WRITE_SECURE_SETTINGS appears to be granted")
                Result.success()
            } else {
                Timber.w("WRITE_SECURE_SETTINGS not yet granted; retrying")
                Result.retry()
            }
        } catch (e: Exception) {
            Timber.e(e, "ShizukuWorker encountered error")
            saveStatus("ERROR: ${e.localizedMessage}")
            Result.retry()
        }
    }

    private fun hasWriteSecureSettings(): Boolean {
        return try {
            val appOps = applicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_WRITE_SECURE_SETTINGS,
                Binder.getCallingUid(),
                applicationContext.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Timber.w(e, "Failed to check AppOps for WRITE_SECURE_SETTINGS")
            false
        }
    }

    private fun saveStatus(msg: String) {
        Timber.d("Saving status: %s", msg)
        applicationContext.getSharedPreferences("phx_status", Context.MODE_PRIVATE)
            .edit().putString("status", msg).apply()
    }

    private fun createForegroundInfo(text: String): ForegroundInfo {
        // Create a notification channel and a minimal notification for foreground execution
        val channel = NotificationChannel(
            NOTIF_CHANNEL_ID,
            "PHX Shizuku Worker",
            NotificationManager.IMPORTANCE_LOW
        )
        val notificationManager =
            applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.createNotificationChannel(channel)

        val notification: Notification = NotificationCompat.Builder(applicationContext, NOTIF_CHANNEL_ID)
            .setContentTitle("PHX Shizuku")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .build()

        return ForegroundInfo(NOTIF_ID, notification)
    }
}
