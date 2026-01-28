package com.example.phxshizukudominator

import rikka.shizuku.Shizuku
import java.io.BufferedReader
import java.io.InputStreamReader
import timber.log.Timber

object ShellCommander {
    fun runCommand(command: String): String {
        Timber.d("Running command via Shizuku: %s", command)
        val process = Shizuku.newProcess(arrayOf("sh", "-c", command))
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        val output = reader.readLines().joinToString("\n")
        // Also attempt to capture stderr for debugging
        try {
            val errReader = BufferedReader(InputStreamReader(process.errorStream))
            val errOutput = errReader.readLines().joinToString("\n")
            if (errOutput.isNotBlank()) {
                Timber.w("Command stderr: %s", errOutput)
            }
        } catch (t: Throwable) {
            Timber.w(t, "Failed reading stderr for command: %s", command)
        }
        Timber.d("Command output: %s", output)
        return output
    }
}
