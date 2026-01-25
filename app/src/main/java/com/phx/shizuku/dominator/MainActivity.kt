package com.phx.shizuku.dominator

import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import moe.shizuku.api.Shizuku
import timber.log.Timber
import com.phx.shizuku.dominator.ShizukuWorker // Corrected import

class MainActivity : AppCompatActivity() {

    private lateinit var keyEditText: EditText
    private lateinit var valueEditText: EditText
    private lateinit var setPropButton: Button
    private lateinit var requestPermButton: Button
    private lateinit var statusTextView: TextView

    private val REQUEST_CODE_SHIZUKU_PERMISSION = 100

    private val binderReceivedListener = Shizuku.OnBinderReceivedListener {
        Timber.d("Shizuku binder received")
        updateShizukuStatus()
    }

    private val binderDeadListener = Shizuku.OnBinderDeadListener {
        Timber.w("Shizuku binder dead")
        updateShizukuStatus()
    }

    private val requestPermissionResultListener =
        Shizuku.OnRequestPermissionResultListener { requestCode, grantResult ->
            if (requestCode == REQUEST_CODE_SHIZUKU_PERMISSION) {
                if (grantResult == PackageManager.PERMISSION_GRANTED) {
                    Timber.d("Shizuku permission granted")
                } else {
                    Timber.w("Shizuku permission denied")
                }
                updateShizukuStatus()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        keyEditText = findViewById(R.id.edit_text_key)
        valueEditText = findViewById(R.id.edit_text_value)
        setPropButton = findViewById(R.id.button_set_prop)
        requestPermButton = findViewById(R.id.button_request_permission)
        statusTextView = findViewById(R.id.text_view_status)

        Shizuku.addBinderReceivedListener(binderReceivedListener)
        Shizuku.addBinderDeadListener(binderDeadListener)
        Shizuku.addRequestPermissionResultListener(requestPermissionResultListener)

        setPropButton.setOnClickListener {
            val key = keyEditText.text.toString()
            val value = valueEditText.text.toString()
            if (key.isNotBlank() && value.isNotBlank()) {
                startSetPropertyWorker(key, value)
            } else {
                statusTextView.text = "Key and value cannot be empty"
            }
        }

        requestPermButton.setOnClickListener {
            requestShizukuPermission()
        }

        updateShizukuStatus()
    }

    override fun onDestroy() {
        super.onDestroy()
        Shizuku.removeBinderReceivedListener(binderReceivedListener)
        Shizuku.removeBinderDeadListener(binderDeadListener)
        Shizuku.removeRequestPermissionResultListener(requestPermissionResultListener)
    }
    
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        Shizuku.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    private fun updateShizukuStatus() {
        val status = when {
            Shizuku.isPreV11() -> "Shizuku is too old"
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED -> "Permission granted"
            Shizuku.shouldShowRequestPermissionRationale() -> "Permission should be granted from Shizuku app"
            else -> "Permission not granted"
        }
        statusTextView.text = "Shizuku Status: $status"
        setPropButton.isEnabled = Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        requestPermButton.isEnabled = Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED
    }

    private fun requestShizukuPermission() {
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            Shizuku.requestPermission(REQUEST_CODE_SHIZUKU_PERMISSION)
        }
    }

    private fun startSetPropertyWorker(key: String, value: String) {
        statusTextView.text = "Enqueuing worker to set '$key' to '$value'"
        val workRequest = OneTimeWorkRequestBuilder<ShizukuWorker>()
            .setInputData(Data.Builder()
                .putString("key", key)
                .putString("value", value)
                .build())
            .build()
        WorkManager.getInstance(this).enqueue(workRequest)
    }
}
