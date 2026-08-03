#!/usr/bin/env bash
# Initialize native targets for iblokz-ide.
#
# Scaffold / verify only — does not run web or package builds (see ./bin/build.sh).
#
# Usage:
#   ./bin/init.sh                  # same as --all (capability-gated)
#   ./bin/init.sh --electron
#   ./bin/init.sh --app-image
#   ./bin/init.sh --android
#   ./bin/init.sh --macos
#   ./bin/init.sh --ios
#   ./bin/init.sh --all
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_ELECTRON=0
DO_APP_IMAGE=0
DO_ANDROID=0
DO_MACOS=0
DO_IOS=0
USE_ALL=0

enable_all() {
  USE_ALL=1
  if is_darwin; then
    DO_MACOS=1
    DO_IOS=1
    DO_ANDROID=1
    DO_APP_IMAGE=1
    DO_ELECTRON=1
  else
    DO_APP_IMAGE=1
    DO_ELECTRON=1
    DO_ANDROID=1
  fi
}

usage() {
  echo "Usage: $0 [--electron] [--app-image] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  (no flags)  Same as --all (skips targets this host cannot init)"
  echo "  --electron  Ensure Electron deps and electron/ shell"
  echo "  --app-image Ensure Electron + electron-builder (Linux AppImage packaging)"
  echo "  --android   Capacitor: cap add android if missing (JDK + Android SDK)"
  echo "  --macos     Electron shell for macOS DMG packaging (best on Darwin)"
  echo "  --ios       Capacitor: cap add ios if missing (Darwin + Xcode + CocoaPods)"
  echo "  --all       Host candidates; skip unavailable toolchains with a message"
  echo ""
  echo "  Init does not build dist/ or packages — use ./bin/build.sh / ./bin/start.sh"
}

if [ "$#" -eq 0 ]; then
  enable_all
else
  for arg in "$@"; do
    case "$arg" in
      --electron)  DO_ELECTRON=1 ;;
      --app-image) DO_APP_IMAGE=1; DO_ELECTRON=1 ;;
      --android)   DO_ANDROID=1 ;;
      --macos)     DO_MACOS=1; DO_ELECTRON=1 ;;
      --ios)       DO_IOS=1 ;;
      --all)       enable_all ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
    esac
  done
fi

require_pnpm

echo "Installing dependencies..."
pnpm install

# Upfront OS dep report + soft-skips under --all / hard-fail for explicit Cap targets
preflight_os_deps

RAN_ANY=0

if [ "$DO_ELECTRON" -eq 1 ]; then
  if [ "$USE_ALL" -eq 1 ] && ! has_electron_shell; then
    skip_target "electron" "Electron shell or node_modules/electron missing after pnpm install" || true
  else
    echo "Electron: verifying electron/ shell..."
    require_electron_shell
    echo "Electron ready. Dev: pnpm start:electron"
    RAN_ANY=1
  fi
fi

if [ "$DO_APP_IMAGE" -eq 1 ]; then
  if [ "$USE_ALL" -eq 0 ]; then
    if ! reason=$(can_app_image); then
      echo "app-image: $reason" >&2
      exit 1
    fi
  fi
  if [ "$DO_APP_IMAGE" -eq 1 ]; then
    echo "AppImage packaging deps ready. Build: ./bin/build.sh --app-image"
    RAN_ANY=1
  fi
fi

if [ "$DO_MACOS" -eq 1 ]; then
  if [ "$USE_ALL" -eq 0 ]; then
    require_electron_shell
    if ! is_darwin; then
      echo "Warning: macOS DMG packaging requires Darwin; Electron shell verified for cross-dev only." >&2
    else
      require_xcode
    fi
  fi
  if [ "$DO_MACOS" -eq 1 ]; then
    echo "macOS ready (Electron run target: macOS 11+)."
    echo "  Dev:   pnpm start:macos"
    echo "  Build: ./bin/build.sh --macos"
    RAN_ANY=1
  fi
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json" >&2
    exit 1
  fi
  require_java
  ensure_android_sdk
  echo "Using Android SDK at $ANDROID_HOME"
  if [ ! -d android ]; then
    echo "Adding Android platform (cap add)..."
    pnpm exec cap add android
  else
    echo "Android platform already present (android/)."
  fi
  ensure_android_cleartext
  ensure_android_gradle_for_jdk
  echo "Android ready (no web build — run ./bin/build.sh --android or ./bin/start.sh --android)."
  RAN_ANY=1
fi

if [ "$DO_IOS" -eq 1 ]; then
  require_darwin "iOS init"
  require_xcode_for_capacitor_ios
  require_core_simulator
  require_cocoapods
  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json" >&2
    exit 1
  fi
  if [ ! -d ios ]; then
    echo "Adding iOS platform (cap add)..."
    pnpm exec cap add ios
  else
    echo "iOS platform already present (ios/)."
  fi
  if [ -f ios/App/Podfile ]; then
    echo "pod install..."
    (cd ios/App && pod install)
  fi
  echo "iOS ready (no web build — run ./bin/build.sh --ios or ./bin/start.sh --ios)."
  RAN_ANY=1
fi

if [ "$USE_ALL" -eq 1 ] && [ "$RAN_ANY" -eq 0 ]; then
  echo "init: no targets could be initialized on this host." >&2
  exit 1
fi

echo "init done."
