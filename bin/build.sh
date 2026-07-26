#!/usr/bin/env bash
# Build native artifacts into artifacts/.
#
# Usage:
#   ./bin/build.sh --electron   # Stage 6: AppImage; until then web build + note
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
  echo "  --electron  Web build + AppImage when electron-builder is configured (else note)"
  echo "  --android   Web build + Cap sync + debug APK → artifacts/android/"
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

echo "Building web app..."
pnpm run build

NAME=$(node -p "require('./package.json').name")

if [ "$DO_ELECTRON" -eq 1 ]; then
  if command -v pnpm >/dev/null && pnpm exec electron-builder --help &>/dev/null 2>&1; then
    echo "Building Linux AppImage..."
    pnpm exec electron-builder --linux AppImage --config.directories.output=artifacts/electron
    echo "Electron artifacts under artifacts/electron/"
  else
    echo "[electron] Web dist ready. AppImage via electron-builder lands in Stage 6."
    echo "           Dev run: pnpm start:electron"
    echo "           Placeholder: artifacts/electron/${NAME}-dev.txt"
    echo "Built $(date -Iseconds) from dist/ — use pnpm start:electron for now." \
      > "artifacts/electron/${NAME}-dev.txt"
  fi
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    stub_target "android (Capacitor not configured yet — Stage 5)" "artifacts/android"
  else
    require_java
    if [ ! -d android ]; then
      npx cap add android
    fi
    npx cap sync android
    (cd android && ./gradlew assembleDebug)
    cp android/app/build/outputs/apk/debug/app-debug.apk \
      "artifacts/android/${NAME}-debug.apk"
    echo "Android APK: artifacts/android/${NAME}-debug.apk"
  fi
fi

if [ "$DO_MACOS" -eq 1 ]; then
  stub_target "macos" "artifacts/macos"
fi

if [ "$DO_IOS" -eq 1 ]; then
  stub_target "ios" "artifacts/ios"
fi

echo "build done."
