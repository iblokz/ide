#!/usr/bin/env bash
# Start the IDE for a given target.
#
# Usage:
#   ./bin/start.sh              # web (Parcel)
#   ./bin/start.sh --electron
#   ./bin/start.sh --android    # Stage 5 stub
#   ./bin/start.sh --macos      # skeleton
#   ./bin/start.sh --ios        # skeleton
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

TARGET=web

usage() {
  echo "Usage: $0 [--electron|--android|--macos|--ios] [--help]"
  echo ""
  echo "  (no flags)  Web: Parcel at http://127.0.0.1:1234"
  echo "  --electron  Parcel + Electron shell"
  echo "  --android   Capacitor Android run (Stage 5; stub until Cap is added)"
  echo "  --macos     Skeleton only"
  echo "  --ios       Skeleton only"
}

for arg in "$@"; do
  case "$arg" in
    --electron) TARGET=electron ;;
    --android)  TARGET=android ;;
    --macos)    TARGET=macos ;;
    --ios)      TARGET=ios ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

require_pnpm

case "$TARGET" in
  web)
    echo "Starting web (Parcel)..."
    exec pnpm start
    ;;
  electron)
    if [ ! -f electron/main.js ] || [ ! -f electron/preload.js ]; then
      echo "Missing electron/ shell — run: ./bin/init.sh --electron" >&2
      exit 1
    fi
    echo "Starting Electron (Parcel + shell)..."
    exec pnpm start:electron
    ;;
  android)
    if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
      stub_target "android (Capacitor not configured yet — Stage 5)" "artifacts/android"
      exit 0
    fi
    require_java
    echo "Starting Android (Capacitor)..."
    exec npx cap run android
    ;;
  macos)
    stub_target "macos" "artifacts/macos"
    ;;
  ios)
    stub_target "ios" "artifacts/ios"
    ;;
esac
