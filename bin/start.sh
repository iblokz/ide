#!/usr/bin/env bash
# Start the IDE for a given target.
#
# Usage:
#   ./bin/start.sh              # web (Parcel)
#   ./bin/start.sh --electron
#   ./bin/start.sh --macos      # same as --electron (Electron shell)
#   ./bin/start.sh --android    # Cap sync + run on device/emulator
#   ./bin/start.sh --ios        # Cap sync + run on simulator/device
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
  echo "Usage: $0 [--electron|--macos|--android|--ios] [--help]"
  echo ""
  echo "  (no flags)  Web: Parcel at http://127.0.0.1:${PARCEL_PORT}"
  echo "  --electron  Parcel + Electron shell"
  echo "  --macos     Same as --electron (desktop shell on macOS)"
  echo "  --android   Parcel on 0.0.0.0 + Cap WebView → http://<machine-ip>:${PARCEL_PORT}"
  echo "  --ios       Parcel on 0.0.0.0 + Cap iOS live-reload"
  echo ""
  echo "  Mobile: CAP_DEV_HOST=<ip>  override auto-detected machine LAN IP"
}

for arg in "$@"; do
  case "$arg" in
    --electron) TARGET=electron ;;
    --macos)    TARGET=electron ;;
    --android)  TARGET=android ;;
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
    # Fail fast if the background Parcel/pnpm process already died (e.g. SIGABRT)
    if [ -n "${PARCEL_PID:-}" ] && ! kill -0 "$PARCEL_PID" 2>/dev/null; then
      wait "$PARCEL_PID" 2>/dev/null || true
      echo "Parcel exited before becoming ready (pid ${PARCEL_PID})" >&2
      return 2
    fi
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
  PARCEL_PID=
  pkill -f "parcel --port ${PARCEL_PORT}" 2>/dev/null || true
}

# Parcel occasionally SIGABRTs on a corrupt LMDB .parcel-cache ("mutex lock failed").
# Clear cache and retry instead of leaving the user to killall/rm by hand.
start_parcel_ready() {
  local attempt=1
  local max_attempts=3
  local rc=1
  while (( attempt <= max_attempts )); do
    stop_parcel
    sleep 0.3
    if (( attempt > 1 )); then
      echo "Starting Parcel (attempt ${attempt}/${max_attempts})..."
    fi
    pnpm exec parcel "$@" &
    PARCEL_PID=$!
    trap stop_parcel EXIT INT TERM
    if wait_for_port "$PARCEL_PORT" 127.0.0.1; then
      return 0
    fi
    rc=$?
    stop_parcel
    if (( attempt >= max_attempts )); then
      break
    fi
    if [ -d .parcel-cache ]; then
      rm -rf .parcel-cache
      echo "Cleared .parcel-cache after Parcel crash/timeout; retrying..."
    else
      echo "Parcel failed to start; retrying..."
    fi
    attempt=$((attempt + 1))
  done
  return "$rc"
}

start_electron_shell() {
  require_electron_shell
  if [ ! -x node_modules/.bin/electron ] && [ ! -f node_modules/electron/cli.js ]; then
    echo "Electron not installed — run: pnpm install" >&2
    exit 1
  fi
  echo "Starting Electron (Parcel + shell)..."
  if ! start_parcel_ready --port "$PARCEL_PORT"; then
    exit 1
  fi
  pnpm exec electron .
}

start_cap_live_reload() {
  local platform="$1" # android | ios

  if [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.ts ]; then
    echo "Missing capacitor.config.json — run: ./bin/init.sh --${platform}" >&2
    exit 1
  fi

  # Native shell + plugin sync (webDir must exist; HMR serves from Parcel)
  if [ ! -d dist ] || [ ! -f dist/index.html ]; then
    echo "No dist/ yet — running one-time build:cap for Cap webDir..."
    pnpm run build:cap
  fi
  if [ ! -d "$platform" ]; then
    pnpm exec cap add "$platform"
  fi
  pnpm exec cap sync "$platform"
  if [ "$platform" = android ]; then
    ensure_android_cleartext
    ensure_android_gradle_for_jdk
    "$SCRIPT_DIR/assets.sh" --sync-android
  fi
  if [ "$platform" = ios ] && [ -f ios/App/Podfile ] && [ ! -d ios/App/Pods ]; then
    (cd ios/App && pod install)
  fi

  if [ -n "${CAP_DEV_HOST:-}" ]; then
    DEV_HOST="$CAP_DEV_HOST"
  else
    DEV_HOST="$(detect_lan_ip || true)"
  fi
  if [ -z "$DEV_HOST" ]; then
    echo "Could not detect machine LAN IP. Set CAP_DEV_HOST=<ip> and retry." >&2
    exit 1
  fi
  echo "Cap / HMR host: ${DEV_HOST}:${PARCEL_PORT} (override with CAP_DEV_HOST)"

  echo "Starting Parcel on 0.0.0.0:${PARCEL_PORT} (HMR host ${DEV_HOST})..."
  if ! start_parcel_ready \
    --host 0.0.0.0 \
    --port "$PARCEL_PORT" \
    --hmr-host "$DEV_HOST" \
    --hmr-port "$PARCEL_PORT"
  then
    exit 1
  fi

  echo "Starting ${platform} (Cap → http://${DEV_HOST}:${PARCEL_PORT})..."
  pnpm exec cap run "$platform" \
    --live-reload \
    --host "$DEV_HOST" \
    --port "$PARCEL_PORT"
}

case "$TARGET" in
  web)
    echo "Starting web (Parcel on 0.0.0.0:${PARCEL_PORT})..."
    exec pnpm exec parcel --host 0.0.0.0 --port "$PARCEL_PORT"
    ;;
  electron)
    start_electron_shell
    ;;
  android)
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
    # Emulator-only → special alias for the host loopback
    if [ -z "${CAP_DEV_HOST:-}" ] && [ -z "$DEVICES" ]; then
      export CAP_DEV_HOST=10.0.2.2
    fi
    start_cap_live_reload android
    ;;
  ios)
    require_darwin "iOS start"
    require_xcode_for_capacitor_ios
    require_core_simulator
    require_cocoapods
    start_cap_live_reload ios
    ;;
esac
