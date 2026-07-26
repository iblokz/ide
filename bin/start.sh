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
PARCEL_PORT=1234

usage() {
  echo "Usage: $0 [--electron|--android|--macos|--ios] [--help]"
  echo ""
  echo "  (no flags)  Web: Parcel at http://127.0.0.1:${PARCEL_PORT}"
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

"$SCRIPT_DIR/assets.sh"

wait_for_port() {
  local port="${1:-$PARCEL_PORT}"
  local host="${2:-127.0.0.1}"
  local deadline=$((SECONDS + 45))
  echo "Waiting for http://${host}:${port} ..."
  while (( SECONDS < deadline )); do
    if command -v curl &>/dev/null; then
      if curl -sf -o /dev/null "http://${host}:${port}/"; then
        return 0
      fi
    else
      if (echo >/dev/tcp/"$host"/"$port") 2>/dev/null; then
        return 0
      fi
    fi
    sleep 0.25
  done
  echo "Timed out waiting for port ${port}" >&2
  return 1
}

stop_parcel() {
  # Prefer tracked pid; also clean orphans bound to our port
  if [ -n "${PARCEL_PID:-}" ]; then
    kill "$PARCEL_PID" 2>/dev/null || true
    wait "$PARCEL_PID" 2>/dev/null || true
  fi
  pkill -f "parcel --port ${PARCEL_PORT}" 2>/dev/null || true
}

case "$TARGET" in
  web)
    echo "Starting web (Parcel)..."
    exec pnpm exec parcel --port "$PARCEL_PORT"
    ;;
  electron)
    if [ ! -f electron/main.js ] || [ ! -f electron/preload.js ]; then
      echo "Missing electron/ shell — run: ./bin/init.sh --electron" >&2
      exit 1
    fi
    if [ ! -x node_modules/.bin/electron ] && [ ! -f node_modules/electron/cli.js ]; then
      echo "Electron not installed — run: pnpm install" >&2
      exit 1
    fi
    echo "Starting Electron (Parcel + shell)..."
    stop_parcel
    sleep 0.3
    pnpm exec parcel --port "$PARCEL_PORT" &
    PARCEL_PID=$!
    trap stop_parcel EXIT INT TERM
    if ! wait_for_port "$PARCEL_PORT"; then
      stop_parcel
      exit 1
    fi
    pnpm exec electron .
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
