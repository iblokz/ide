#!/usr/bin/env bash
# Deploy built artifacts to a device / run desktop app.
#
# Usage:
#   ./bin/deploy.sh --electron
#   ./bin/deploy.sh --android
#   ./bin/deploy.sh --macos | --ios   # stubs
#   ./bin/deploy.sh --build --android
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_BUILD=0
DO_ELECTRON=0
DO_ANDROID=0
DO_MACOS=0
DO_IOS=0

usage() {
  echo "Usage: $0 [--build] [--electron] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  --build     Run ./bin/build.sh for the same targets first"
  echo "  --electron  Install AppImage + .desktop (~/.local), else pnpm start:electron"
  echo "  --android   adb install latest artifacts/android/*.apk"
  echo "  --macos     Skeleton"
  echo "  --ios       Skeleton"
}

for arg in "$@"; do
  case "$arg" in
    --build)    DO_BUILD=1 ;;
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

BUILD_ARGS=()
[ "$DO_ELECTRON" -eq 1 ] && BUILD_ARGS+=(--electron)
[ "$DO_ANDROID" -eq 1 ] && BUILD_ARGS+=(--android)
[ "$DO_MACOS" -eq 1 ] && BUILD_ARGS+=(--macos)
[ "$DO_IOS" -eq 1 ] && BUILD_ARGS+=(--ios)

if [ "$DO_BUILD" -eq 1 ]; then
  "$SCRIPT_DIR/build.sh" "${BUILD_ARGS[@]}"
fi

if [ "$DO_ELECTRON" -eq 1 ]; then
  # Prefer newest AppImage (mtime).
  APPIMAGE=$(ls -1t artifacts/electron/*.AppImage 2>/dev/null | head -n1 || true)
  if [ -n "$APPIMAGE" ]; then
    install_electron_appimage "$APPIMAGE"
  else
    echo "No AppImage yet — starting dev Electron (needs Parcel on :1234)..."
    pnpm run start:electron
  fi
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  require_adb
  APK=$(ls -1t artifacts/android/*.apk 2>/dev/null | head -n1 || true)
  if [ -z "$APK" ]; then
    echo "No APK in artifacts/android/. Run: ./bin/build.sh --android" >&2
    exit 1
  fi
  echo "Installing $APK ..."
  adb install -r "$APK"
fi

if [ "$DO_MACOS" -eq 1 ]; then
  stub_target "macos deploy" "artifacts/macos"
fi

if [ "$DO_IOS" -eq 1 ]; then
  stub_target "ios deploy" "artifacts/ios"
fi

echo "deploy done."
