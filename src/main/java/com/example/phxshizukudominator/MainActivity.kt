package com.example.phxshizukudominator

import android.app.AppOpsManager
import android.content.Context
import android.os.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.work.*
import rikka.shizuku.Shizuku
import timber.log.Timber
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    private lateinit var statusText: TextView
    private lateinit var requestBtn: Button
    private lateinit var grantBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Init Timber for debug logging
        Timber.plant(Timber.DebugTree())

        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        requestBtn = findViewById(R.id.requestPermissionButton)
        grantBtn = findViewById(R.id.grantPermissionButton)

        requestBtn.setOnClickListener {
            Timber.d("User tapped request Shizuku permission")
            Shizuku.requestPermission(0)
        }
        grantBtn.setOnClickListener {
            Timber.d("User tapped grant button: enqueue one-time ShizukuWorker")
            WorkManager.getInstance(this)
                .enqueue(OneTimeWorkRequestBuilder<ShizukuWorker>().build())
        }

        updateStatusLoop()
        scheduleJob()

        Timber.d("MainActivity created. WRITE_SECURE_SETTINGS granted=%s", hasWriteSecureSettings())
    }

    private fun updateStatusLoop() {
        val handler = Handler(Looper.getMainLooper())
        handler.post(object : Runnable {
            override fun run() {
                val text = getSharedPreferences("phx_status", MODE_PRIVATE)
                    .getString("status", "UNKNOWN")
                statusText.text = "SHIZUKU STATUS: $text"
                handler.postDelayed(this, 5000)
            }
        })
    }

    private fun scheduleJob() {
        val request = PeriodicWorkRequestBuilder<ShizukuWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "shizuku_task", ExistingPeriodicWorkPolicy.KEEP, request
        )
        Timber.d("Periodic ShizukuWorker scheduled")
    }

    private fun hasWriteSecureSettings(): Boolean {
        return try {
            val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_WRITE_SECURE_SETTINGS,
                android.os.Process.myUid(),
                packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Timber.w(e, "Failed to check AppOps for WRITE_SECURE_SETTINGS")
            false
        }
    }
}
