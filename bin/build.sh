#!/usr/bin/env bash
# Build native artifacts into artifacts/.
#
# Usage:
#   ./bin/build.sh --electron   # AppImage → artifacts/electron/
#   ./bin/build.sh --android    # Stage 5: APK
#   ./bin/build.sh --macos      # skeleton
#   ./bin/build.sh --ios        # skeleton
#   ./bin/build.sh --all
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_ELECTRON=0
DO_ANDROID=0
DO_MACOS=0
DO_IOS=0

usage() {
  echo "Usage: $0 [--electron] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  --electron  Web build (./) + Linux AppImage → artifacts/electron/"
  echo "  --android   Web build + Cap sync + debug APK → artifacts/android/ (packaged, no live-reload)"
  echo "  --macos     Skeleton only"
  echo "  --ios       Skeleton only"
  echo "  --all       electron + android (INCLUDE_APPLE=1 also runs macos/ios stubs)"
}

for arg in "$@"; do
  case "$arg" in
    --electron) DO_ELECTRON=1 ;;
    --android)  DO_ANDROID=1 ;;
    --macos)    DO_MACOS=1 ;;
    --ios)      DO_IOS=1 ;;
    --all)
      DO_ELECTRON=1
      DO_ANDROID=1
      if [ "${INCLUDE_APPLE:-0}" = "1" ]; then
        DO_MACOS=1
        DO_IOS=1
      fi
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

if [ "$DO_ELECTRON" -eq 0 ] && [ "$DO_ANDROID" -eq 0 ] && [ "$DO_MACOS" -eq 0 ] && [ "$DO_IOS" -eq 0 ]; then
  usage >&2
  exit 1
fi

require_pnpm
mkdir -p artifacts/electron artifacts/android artifacts/macos artifacts/ios

NAME=$(node -p "require('./package.json').name")

# Favicons / icons live in gitignored src/assets — always generate before Parcel.
# (pnpm prebuild:* also runs assets; this covers direct parcel invocations.)
ensure_web_assets() {
  if [ ! -f src/assets/favicon-32.png ]; then
    echo "Generating web assets (src/assets/)…"
    "$SCRIPT_DIR/assets.sh"
  fi
}

if [ "$DO_ELECTRON" -eq 1 ]; then
  ensure_web_assets
  echo "Building web app for Electron (public-url ./)..."
  pnpm run build:electron
  echo "Building Linux AppImage..."
  pnpm exec electron-builder --linux AppImage --publish never
  echo "Electron artifacts under artifacts/electron/"
  ls -la artifacts/electron/*.AppImage 2>/dev/null || true
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json — run Stage 5 setup first" >&2
    exit 1
  fi
  require_java
  ensure_android_sdk
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
  cp android/app/build/outputs/apk/debug/app-debug.apk \
    "artifacts/android/${NAME}-debug.apk"
  echo "Android APK: artifacts/android/${NAME}-debug.apk"
fi

if [ "$DO_MACOS" -eq 1 ]; then
  stub_target "macos" "artifacts/macos"
fi

if [ "$DO_IOS" -eq 1 ]; then
  stub_target "ios" "artifacts/ios"
fi

echo "build done."
