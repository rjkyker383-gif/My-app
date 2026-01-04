package com.example.phxshizukudominator

import rikka.shizuku.Shizuku
import java.io.BufferedReader
import java.io.InputStreamReader

object ShellCommander {
    fun runCommand(command: String): String {
        val process = Shizuku.newProcess(arrayOf("sh", "-c", command))
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        return reader.readLines().joinToString("\n")
    }
}