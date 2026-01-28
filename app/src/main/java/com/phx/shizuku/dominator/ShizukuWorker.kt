package com.phx.shizuku.dominator

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import moe.shizuku.api.Shizuku
import moe.shizuku.api.ShizukuSystemProperties
import timber.log.Timber

class ShizukuWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val NOTIF_CHANNEL_ID = "phx_shizuku_worker"
        private const val NOTIF_ID = 1
    }

    override suspend fun doWork(): Result {
        val key = inputData.getString("key")
        val value = inputData.getString("value")

        if (key.isNullOrBlank()) {
            val msg = "Work failed: key is missing"
            Timber.e(msg)
            saveStatus(msg)
            return Result.failure()
        }

        val text = "Setting prop $key to $value"
        setForeground(createForegroundInfo(text))
        saveStatus("Starting to set prop $key...")
        Timber.d(text)

        return withContext(Dispatchers.IO) {
            if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                val msg = "Shizuku permission not granted"
                Timber.e(msg)
                saveStatus(msg)
                return@withContext Result.failure()
            }

            if (!checkAppOps()) {
                val msg = "AppOps for WRITE_SECURE_SETTINGS not granted"
                Timber.e(msg)
                saveStatus(msg)
                return@withContext Result.failure()
            }

            try {
                ShizukuSystemProperties.set(key, value)
                val readValue = ShizukuSystemProperties.get(key)
                val resultMsg = if (readValue == value) {
                    "Successfully set $key to $value"
                } else {
                    "Failed to set $key, value is $readValue"
                }
                Timber.d(resultMsg)
                saveStatus(resultMsg)
                return@withContext if (readValue == value) Result.success() else Result.failure()
            } catch (e: Throwable) {
                val msg = "Failed to set property with Shizuku: ${e.message}"
                Timber.e(e, msg)
                saveStatus(msg)
                return@withContext Result.failure()
            }
        }
    }

    private fun checkAppOps(): Boolean {
        return try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_WRITE_SECURE_SETTINGS,
                android.os.Process.myUid(),
                context.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Timber.w(e, "Failed to check AppOps for WRITE_SECURE_SETTINGS")
            false
        }
    }

    private fun saveStatus(msg: String) {
        Timber.d("Saving status: %s", msg)
        context.getSharedPreferences("phx_status", Context.MODE_PRIVATE)
            .edit().putString("status", msg).apply()
    }

    private fun createForegroundInfo(text: String): ForegroundInfo {
        val channel = NotificationChannel(
            NOTIF_CHANNEL_ID,
            "PHX Shizuku Worker",
            NotificationManager.IMPORTANCE_LOW
        )
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.createNotificationChannel(channel)
        val notification: Notification = NotificationCompat.Builder(context, NOTIF_CHANNEL_ID)
            .setContentTitle("PHX Shizuku")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .build()
        return ForegroundInfo(NOTIF_ID, notification)
    }
}
