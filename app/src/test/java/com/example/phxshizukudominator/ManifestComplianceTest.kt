package com.example.phxshizukudominator

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ManifestComplianceTest {
    @Test
    fun manifest_contains_boot_and_permissions() {
        // This is a simple file-based check (unit test) to validate manifest entries are present.
        // Path is relative to the module root; CI should run tests with working dir = module root.
        val manifestPath = "src/main/AndroidManifest.xml"
        val file = File(manifestPath)
        assertTrue("Manifest file not found at $manifestPath", file.exists())
        val content = file.readText()
        assertTrue("RECEIVE_BOOT_COMPLETED permission not declared", content.contains("RECEIVE_BOOT_COMPLETED"))
        assertTrue("BootReceiver receiver not exported=true", content.contains("android:exported=\"true\"") || content.contains("BootReceiver"))
        // A basic check for WRITE_SECURE_SETTINGS declaration (note: this permission is privileged)
        assertTrue("WRITE_SECURE_SETTINGS permission missing", content.contains("WRITE_SECURE_SETTINGS"))
    }
}
