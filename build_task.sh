#!/data/data/com.termux/files/usr/bin/bash
set -e

# ===== PROJECT ROOT =====
PROJECT_DIR="$HOME/app"
cd "$PROJECT_DIR"

echo "== Detecting Java in Termux =="

# Termux prefix
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"

# Prefer OpenJDK 17 explicitly
if [ -d "$PREFIX/lib/jvm/java-17-openjdk" ]; then
  export JAVA_HOME="$PREFIX/lib/jvm/java-17-openjdk"
  echo "Using JAVA_HOME=$JAVA_HOME"
else
  echo "WARN: Could not find java-17-openjdk under:"
  echo "      $PREFIX/lib/jvm/"
  echo "Falling back to whatever 'java' is on PATH."
  JAVA_HOME=""
fi

if [ -n "$JAVA_HOME" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

echo ""
echo "== java -version =="
java -version || {
  echo "ERROR: 'java' is not working. Gradle cannot run."
  exit 1
}

echo ""
echo "== Running Gradle build (clean + assembleDebug) =="
./gradlew clean assembleDebug

echo ""
echo "== Searching for newest APK under build/outputs =="
APK_PATH=$(find . -path "*build/outputs/apk/*/*.apk" | sort -r | head -n 1)

if [ -z "$APK_PATH" ]; then
  echo "No APK found under build/outputs/apk."
  exit 1
fi

echo "✅ Built APK:"
echo "    $APK_PATH"
echo ""
echo "You can now copy this APK somewhere visible and install it."
echo "Done."
