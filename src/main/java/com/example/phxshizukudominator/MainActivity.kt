package com.example.phxshizukudominator

import android.os.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.work.*
import rikka.shizuku.Shizuku
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    private lateinit var statusText: TextView
    private lateinit var requestBtn: Button
    private lateinit var grantBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        requestBtn = findViewById(R.id.requestPermissionButton)
        grantBtn = findViewById(R.id.grantPermissionButton)

        requestBtn.setOnClickListener { Shizuku.requestPermission(0) }
        grantBtn.setOnClickListener {
            WorkManager.getInstance(this)
                .enqueue(OneTimeWorkRequestBuilder<ShizukuWorker>().build())
        }

        updateStatusLoop()
        scheduleJob()
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
    }
}