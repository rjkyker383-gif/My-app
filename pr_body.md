## Summary

This PR:
- Bumps Shizuku API to moe.shizuku:api:13.6.0
- Adds Timber logging (com.jakewharton.timber:timber:5.0.1) and initializes it in MainActivity
- Adds foreground notification support to ShizukuWorker to mitigate Android 12+ background start restrictions
- Adds debug logging in BootReceiver, MainActivity, ShizukuWorker, and ShellCommander
- Declares WRITE_SECURE_SETTINGS in the manifest (note: privileged permission — must be granted by Shizuku Manager / system)
- Ensures BootReceiver is exported so BOOT_COMPLETED can be delivered
- Adds a basic JVM unit test (ManifestComplianceTest) to verify key manifest entries are present

## Files changed
- src/main/java/com/example/phxshizukudominator/BootReceiver.kt
- src/main/java/com/example/phxshizukudominator/MainActivity.kt
- src/main/java/com/example/phxshizukudominator/ShizukuWorker.kt
- src/main/java/com/example/phxshizukudominator/ShellCommander.kt
- app/src/main/AndroidManifest.xml
- app/build.gradle
- app/src/test/java/com/example/phxshizukudominator/ManifestComplianceTest.kt

## Testing / Notes

1. Build locally:
   - ./gradlew assembleDebug
2. Install and open the app at least once so BOOT receivers will be delivered after reboot.
3. Ensure Shizuku Manager (the privileged service) is running on the device and grant this app Shizuku permission when prompted.
4. Use the app UI:
   - REQUEST SHIZUKU PERMISSION button -> opens Shizuku permission flow.
   - GRANT WRITE_SECURE_SETTINGS TO SELF -> enqueues a one-time worker that runs `pm grant` via Shizuku.
5. Monitor logcat (Timber -> Logcat) to see debug messages from BootReceiver, MainActivity, ShizukuWorker, and ShellCommander.
6. The unit test verifies manifest entries and can run with: ./gradlew test

## Caveats
- Declaring WRITE_SECURE_SETTINGS does not grant it. It is a privileged permission; Shizuku Manager must grant it (or it must be granted via adb/system).
- The push command in this script requires that you have permissions to push to the remote and that your git credentials are configured.
- The script sets temporary git user.name/user.email in this repo if not configured globally.

## Optional: Create PR with GitHub CLI

If you have the GitHub CLI (gh) installed and authenticated, run:

gh pr create --base main --head "${BRANCH}" --title "feat: add Shizuku v13.6.0, Timber logging, foreground worker, boot receiver fixes" --body-file pr_body.md

