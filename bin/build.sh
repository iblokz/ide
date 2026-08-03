#!/usr/bin/env bash
# Build native artifacts into artifacts/.
#
# Usage:
#   ./bin/build.sh --app-image  # Linux AppImage → artifacts/electron/
#   ./bin/build.sh --android    # debug APK → artifacts/android/
#   ./bin/build.sh --macos      # DMG → artifacts/macos/ (Darwin; host arch, or MACOS_ARCHES)
#   ./bin/build.sh --ios        # simulator .app.zip → artifacts/ios/
#   ./bin/build.sh --all        # capability-gated
#
# Env:
#   MACOS_ARCHES  — space-separated electron-builder arch flags, e.g. "--x64 --arm64"
#                   (CI sets this for universal). Default: host arch only.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_APP_IMAGE=0
DO_ANDROID=0
DO_MACOS=0
DO_IOS=0
USE_ALL=0

usage() {
  echo "Usage: $0 [--app-image] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  --app-image  Web build (./) + Linux AppImage → artifacts/electron/"
  echo "  --android    Web build + Cap sync + debug APK → artifacts/android/"
  echo "  --macos      Web build + Electron macOS DMG → artifacts/macos/ (Darwin)"
  echo "  --ios        Web build + Cap sync + iOS Simulator app zip → artifacts/ios/"
  echo "  --all        Host candidates; skip unavailable toolchains with a message"
  echo ""
  echo "  Deprecated: --electron is an alias for --app-image (build/deploy only)."
}

for arg in "$@"; do
  case "$arg" in
    --app-image) DO_APP_IMAGE=1 ;;
    --electron)
      echo "Note: --electron is deprecated for packaging; use --app-image" >&2
      DO_APP_IMAGE=1
      ;;
    --android) DO_ANDROID=1 ;;
    --macos)   DO_MACOS=1 ;;
    --ios)     DO_IOS=1 ;;
    --all)
      USE_ALL=1
      if is_darwin; then
        DO_MACOS=1
        DO_IOS=1
        DO_ANDROID=1
        DO_APP_IMAGE=1
      else
        DO_APP_IMAGE=1
        DO_ANDROID=1
      fi
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

if [ "$DO_APP_IMAGE" -eq 0 ] && [ "$DO_ANDROID" -eq 0 ] && [ "$DO_MACOS" -eq 0 ] && [ "$DO_IOS" -eq 0 ]; then
  usage >&2
  exit 1
fi

require_pnpm
mkdir -p artifacts/electron artifacts/android artifacts/macos artifacts/ios

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
BUILT_ANY=0

# Favicons / icons live in gitignored src/assets — always generate before Parcel.
ensure_web_assets() {
  if [ ! -f src/assets/favicon-32.png ]; then
    echo "Generating web assets (src/assets/)…"
    "$SCRIPT_DIR/assets.sh"
  fi
}

maybe_skip() {
  local flag_var="$1"
  local target="$2"
  local check_fn="$3"
  if [ "$USE_ALL" -ne 1 ]; then
    return 0
  fi
  local reason
  if ! reason=$("$check_fn"); then
    skip_target "$target" "$reason" || true
    eval "$flag_var=0"
    return 1
  fi
  return 0
}

maybe_skip DO_APP_IMAGE app-image can_app_image || true
maybe_skip DO_MACOS macos can_macos || true
maybe_skip DO_ANDROID android can_android || true
maybe_skip DO_IOS ios can_ios || true

if [ "$DO_APP_IMAGE" -eq 0 ] && [ "$DO_ANDROID" -eq 0 ] && [ "$DO_MACOS" -eq 0 ] && [ "$DO_IOS" -eq 0 ]; then
  echo "build: no capable targets to build on this host." >&2
  exit 1
fi

if [ "$DO_APP_IMAGE" -eq 1 ]; then
  if [ "$USE_ALL" -eq 0 ]; then
    if ! reason=$(can_app_image); then
      echo "app-image: $reason" >&2
      exit 1
    fi
  fi
  ensure_web_assets
  echo "Building web app for Electron (public-url ./)..."
  pnpm run build:electron
  echo "Building Linux AppImage..."
  pnpm exec electron-builder --linux AppImage --publish never
  echo "AppImage artifacts under artifacts/electron/"
  ls -la artifacts/electron/*.AppImage 2>/dev/null || true
  BUILT_ANY=1
fi

if [ "$DO_MACOS" -eq 1 ]; then
  if [ "$USE_ALL" -eq 0 ]; then
    require_darwin "macOS DMG build"
    if ! reason=$(can_macos); then
      echo "macos: $reason" >&2
      exit 1
    fi
  fi
  ensure_web_assets
  echo "Building web app for Electron (public-url ./)..."
  pnpm run build:electron
  echo "Building macOS DMG (unsigned; macOS 11+) ${MACOS_ARCHES:-(host arch)}..."
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  # MACOS_ARCHES e.g. "--x64 --arm64" (CI universal). Default: host arch only.
  # Avoid empty-array + set -u issues on macOS bash 3.2.
  # shellcheck disable=SC2086
  pnpm exec electron-builder --mac dmg --publish never \
    -c.directories.output=artifacts/macos \
    -c.mac.identity=null \
    ${MACOS_ARCHES:-}
  echo "macOS artifacts under artifacts/macos/"
  ls -la artifacts/macos/*.dmg 2>/dev/null || ls -la artifacts/macos/ 2>/dev/null || true
  BUILT_ANY=1
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json" >&2
    exit 1
  fi
  require_java
  ensure_android_sdk
  echo "Using Android SDK at $ANDROID_HOME"
  ensure_web_assets
  echo "Building web app for Android (public-url ./)..."
  pnpm run build:cap
  if [ ! -d android ]; then
    pnpm exec cap add android
  fi
  pnpm exec cap sync android
  ensure_android_cleartext
  echo "Installing Android launcher icons..."
  "$SCRIPT_DIR/assets.sh" --sync-android
  (cd android && ./gradlew assembleDebug)
  APK_OUT="artifacts/android/${NAME}-${VERSION}-android-debug.apk"
  cp android/app/build/outputs/apk/debug/app-debug.apk "$APK_OUT"
  echo "Android APK: $APK_OUT"
  BUILT_ANY=1
fi

if [ "$DO_IOS" -eq 1 ]; then
  if [ "$USE_ALL" -eq 0 ]; then
    require_darwin "iOS build"
    if ! reason=$(can_ios); then
      echo "ios: $reason" >&2
      exit 1
    fi
  fi
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json" >&2
    exit 1
  fi
  ensure_web_assets
  echo "Building web app for iOS (public-url ./)..."
  pnpm run build:cap
  if [ ! -d ios ]; then
    pnpm exec cap add ios
  fi
  pnpm exec cap sync ios
  if [ -f ios/App/Podfile ]; then
    (cd ios/App && pod install)
  fi
  XC_ENTRY=$(ios_xcode_entry) || {
    echo "No ios/App Xcode project or workspace found after cap sync" >&2
    exit 1
  }
  DERIVED="ios/build"
  rm -rf "$DERIVED"
  echo "Building iOS Simulator app (unsigned)..."
  # shellcheck disable=SC2086
  xcodebuild build \
    $XC_ENTRY \
    -scheme App \
    -configuration Debug \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DERIVED" \
    CODE_SIGNING_ALLOWED=NO
  APP_PATH=$(find "$DERIVED/Build/Products" -name 'App.app' -type d | head -n1 || true)
  if [ -z "$APP_PATH" ]; then
    echo "Could not find App.app under $DERIVED/Build/Products" >&2
    exit 1
  fi
  ZIP_OUT="artifacts/ios/${NAME}-${VERSION}-ios-simulator.app.zip"
  rm -f "$ZIP_OUT"
  (
    cd "$(dirname "$APP_PATH")"
    zip -qr "$PROJECT_ROOT/$ZIP_OUT" "$(basename "$APP_PATH")"
  )
  echo "iOS Simulator zip: $ZIP_OUT"
  BUILT_ANY=1
fi

if [ "$BUILT_ANY" -eq 0 ]; then
  echo "build: nothing was built." >&2
  exit 1
fi

echo "build done."
