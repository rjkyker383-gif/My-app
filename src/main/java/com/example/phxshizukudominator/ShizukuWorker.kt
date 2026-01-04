package com.example.phxshizukudominator

import android.content.Context
import androidx.work.*
import rikka.shizuku.Shizuku

class ShizukuWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            if (!Shizuku.pingBinder()) return Result.retry()
            val result = ShellCommander.runCommand("pm grant ${applicationContext.packageName} android.permission.WRITE_SECURE_SETTINGS")
            saveStatus("GRANTED")
            Result.success()
        } catch (e: Exception) {
            saveStatus("ERROR: ${e.localizedMessage}")
            Result.retry()
        }
    }

    private fun saveStatus(msg: String) {
        applicationContext.getSharedPreferences("phx_status", Context.MODE_PRIVATE)
            .edit().putString("status", msg).apply()
    }
}