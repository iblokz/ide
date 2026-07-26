#!/usr/bin/env bash
# Start the IDE for a given target.
#
# Usage:
#   ./bin/start.sh              # web (Parcel)
#   ./bin/start.sh --electron
#   ./bin/start.sh --android    # Cap sync + run on device/emulator
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
  echo "  --android   Parcel on 0.0.0.0 + Cap WebView → http://<machine-ip>:${PARCEL_PORT}"
  echo "  --macos     Skeleton only"
  echo "  --ios       Skeleton only"
  echo ""
  echo "  Android: CAP_DEV_HOST=<ip>  override auto-detected machine LAN IP"
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

if [ "$TARGET" = android ]; then
  "$SCRIPT_DIR/assets.sh" --sync-android
else
  "$SCRIPT_DIR/assets.sh"
fi

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
    echo "Starting web (Parcel on 0.0.0.0:${PARCEL_PORT})..."
    exec pnpm exec parcel --host 0.0.0.0 --port "$PARCEL_PORT"
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
      stub_target "android (Capacitor not configured)" "artifacts/android"
      exit 0
    fi
    require_java
    ensure_android_sdk
    require_adb
    # native-run fails opaquely with no target — fail fast with a clear hint
    DEVICES=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1}')
    AVDS=$("$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null || true)
    if [ -z "$DEVICES" ] && [ -z "$AVDS" ]; then
      echo "No Android device or emulator found." >&2
      echo "" >&2
      echo "  Device:   enable USB debugging and check: adb devices" >&2
      echo "  Emulator: create an AVD (Android Studio → Device Manager)" >&2
      echo "" >&2
      echo "Packaged APK (no live-reload):" >&2
      echo "  ./bin/build.sh --android && ./bin/deploy.sh --android" >&2
      exit 1
    fi

    # Native shell + plugin sync (webDir must exist; HMR serves from Parcel)
    if [ ! -d dist ] || [ ! -f dist/index.html ]; then
      echo "No dist/ yet — running one-time build:cap for Cap webDir..."
      pnpm run build:cap
    fi
    if [ ! -d android ]; then
      pnpm exec cap add android
    fi
    pnpm exec cap sync android
    ensure_android_cleartext
    echo "Installing Android launcher icons..."
    "$SCRIPT_DIR/assets.sh" --sync-android

    # Cap --live-reload sets server.url to the host Parcel URL (machine LAN IP).
    # Device and PC must be on the same network. Override with CAP_DEV_HOST if needed.
    if [ -n "${CAP_DEV_HOST:-}" ]; then
      DEV_HOST="$CAP_DEV_HOST"
    elif [ -n "$DEVICES" ]; then
      DEV_HOST="$(detect_lan_ip || true)"
    else
      # Emulator → special alias for the host loopback
      DEV_HOST=10.0.2.2
    fi
    if [ -z "$DEV_HOST" ]; then
      echo "Could not detect machine LAN IP. Set CAP_DEV_HOST=<ip> and retry." >&2
      exit 1
    fi
    echo "Cap / HMR host: ${DEV_HOST}:${PARCEL_PORT} (override with CAP_DEV_HOST)"

    echo "Starting Parcel on 0.0.0.0:${PARCEL_PORT} (HMR host ${DEV_HOST})..."
    stop_parcel
    sleep 0.3
    pnpm exec parcel \
      --host 0.0.0.0 \
      --port "$PARCEL_PORT" \
      --hmr-host "$DEV_HOST" \
      --hmr-port "$PARCEL_PORT" &
    PARCEL_PID=$!
    trap stop_parcel EXIT INT TERM
    if ! wait_for_port "$PARCEL_PORT" 127.0.0.1; then
      stop_parcel
      exit 1
    fi

    echo "Starting Android (Cap → http://${DEV_HOST}:${PARCEL_PORT})..."
    pnpm exec cap run android \
      --live-reload \
      --host "$DEV_HOST" \
      --port "$PARCEL_PORT"
    ;;
  macos)
    stub_target "macos" "artifacts/macos"
    ;;
  ios)
    stub_target "ios" "artifacts/ios"
    ;;
esac
