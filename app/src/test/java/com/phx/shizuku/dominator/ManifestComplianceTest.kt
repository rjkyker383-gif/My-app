package com.phx.shizuku.dominator

import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import android.content.pm.PackageManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import android.content.pm.ResolveInfo
import android.content.Intent

@RunWith(RobolectricTestRunner::class)
@Config(manifest = "src/main/AndroidManifest.xml", sdk = [33])
class ManifestComplianceTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun testReceiveBootCompletedPermissionDeclared() {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
        val permissions = packageInfo.requestedPermissions
        assertTrue(permissions.contains("android.permission.RECEIVE_BOOT_COMPLETED"))
    }

    @Test
    fun testWriteSecureSettingsPermissionDeclared() {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
        val permissions = packageInfo.requestedPermissions
        assertTrue(permissions.contains("android.permission.WRITE_SECURE_SETTINGS"))
    }

    @Test
    fun testMainActivityIsLauncherActivity() {
        val packageName = context.packageName
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val activities: List<ResolveInfo> = context.packageManager.queryIntentActivities(intent, 0)
        val isLauncher = activities.any { it.activityInfo.packageName == packageName && it.activityInfo.name.endsWith(".MainActivity") }
        assertTrue(isLauncher)
    }

    @Test
    fun testBootReceiverIsRegisteredAndEnabled() {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_RECEIVERS)
        val receivers = packageInfo.receivers
        val bootReceiver = receivers.firstOrNull { it.name.endsWith(".BootReceiver") }

        assertTrue(bootReceiver != null)
        assertTrue(bootReceiver!!.enabled)
        assertTrue(bootReceiver.exported)

        val intentFilter = bootReceiver.postGetReceivers[0].getIntentFilter() // Assuming one filter
        assertTrue(intentFilter.hasAction(Intent.ACTION_BOOT_COMPLETED))
    }
}