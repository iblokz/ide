#!/usr/bin/env bash
# Initialize native targets for iblokz-ide.
#
# Usage:
#   ./bin/init.sh                  # same as --all (what's available now)
#   ./bin/init.sh --electron
#   ./bin/init.sh --android
#   ./bin/init.sh --macos          # skeleton
#   ./bin/init.sh --ios            # skeleton
#   ./bin/init.sh --all            # electron + android (Apple stubs if INCLUDE_APPLE=1)
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

enable_all() {
  DO_ELECTRON=1
  DO_ANDROID=1
  if [ "${INCLUDE_APPLE:-0}" = "1" ]; then
    DO_MACOS=1
    DO_IOS=1
  fi
}

usage() {
  echo "Usage: $0 [--electron] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  (no flags)  Same as --all"
  echo "  --electron  Ensure Electron deps and electron/ shell"
  echo "  --android   Capacitor Android init (Stage 5; stub until Cap is added)"
  echo "  --macos     Skeleton only"
  echo "  --ios       Skeleton only"
  echo "  --all       electron + android (set INCLUDE_APPLE=1 to also run macos/ios stubs)"
}

if [ "$#" -eq 0 ]; then
  enable_all
else
  for arg in "$@"; do
    case "$arg" in
      --electron) DO_ELECTRON=1 ;;
      --android)  DO_ANDROID=1 ;;
      --macos)    DO_MACOS=1 ;;
      --ios)      DO_IOS=1 ;;
      --all)      enable_all ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
    esac
  done
fi

require_pnpm

echo "Installing dependencies..."
pnpm install

mkdir -p artifacts/electron artifacts/android artifacts/macos artifacts/ios

if [ "$DO_ELECTRON" -eq 1 ]; then
  echo "Electron: verifying electron/ shell..."
  if [ ! -f electron/main.js ] || [ ! -f electron/preload.js ]; then
    echo "Missing electron/main.js or preload.js" >&2
    exit 1
  fi
  if [ ! -d node_modules/electron ]; then
    echo "Electron package missing — run: pnpm add -D electron" >&2
    exit 1
  fi
  echo "Electron ready. Dev: pnpm start:electron"
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    stub_target "android (Capacitor not configured yet — Stage 5)" "artifacts/android"
  else
    require_java
    echo "Building web app for Cap sync..."
    pnpm run build
    if [ ! -d android ]; then
      npx cap add android
    fi
    npx cap sync android
    echo "Android ready. Build APK: ./bin/build.sh --android"
  fi
fi

if [ "$DO_MACOS" -eq 1 ]; then
  stub_target "macos" "artifacts/macos"
fi

if [ "$DO_IOS" -eq 1 ]; then
  stub_target "ios" "artifacts/ios"
fi

echo "init done."
