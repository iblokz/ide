#!/usr/bin/env bash
# Shared Parcel host for all clients; optional platform shells attach to it.
#
# Usage:
#   ./bin/start.sh                         # Parcel on 0.0.0.0 (web / LAN)
#   ./bin/start.sh --electron              # + Electron shell
#   ./bin/start.sh --macos                 # same as --electron
#   ./bin/start.sh --android               # + Cap Android live-reload
#   ./bin/start.sh --ios                   # + Cap iOS live-reload
#   ./bin/start.sh --electron --android    # Parcel once; both clients
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_ELECTRON=0
DO_ANDROID=0
DO_IOS=0
PARCEL_PORT=1234
PARCEL_PID=
CHILD_PIDS=()

usage() {
  echo "Usage: $0 [--electron|--macos] [--android] [--ios] [--help]"
  echo ""
  echo "  Always starts one Parcel server on 0.0.0.0:${PARCEL_PORT} (web + LAN clients)."
  echo "  Platform flags add shells that load that same host (combinable)."
  echo ""
  echo "  (no flags)   Parcel only — open http://127.0.0.1:${PARCEL_PORT} or http://<lan-ip>:${PARCEL_PORT}"
  echo "  --electron   Launch Electron → http://127.0.0.1:${PARCEL_PORT}"
  echo "  --macos      Same as --electron"
  echo "  --android    Cap sync + run (live-reload → http://<lan-ip>:${PARCEL_PORT})"
  echo "  --ios        Cap sync + run iOS live-reload"
  echo ""
  echo "  Mobile: CAP_DEV_HOST=<ip>  override auto-detected machine LAN IP"
}

for arg in "$@"; do
  case "$arg" in
    --electron) DO_ELECTRON=1 ;;
    --macos)    DO_ELECTRON=1 ;;
    --android)  DO_ANDROID=1 ;;
    --ios)      DO_IOS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

require_pnpm

if [ "$DO_ANDROID" -eq 1 ]; then
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

stop_children() {
  local pid
  for pid in "${CHILD_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  CHILD_PIDS=()
}

stop_parcel() {
  if [ -n "${PARCEL_PID:-}" ]; then
    kill "$PARCEL_PID" 2>/dev/null || true
    wait "$PARCEL_PID" 2>/dev/null || true
  fi
  PARCEL_PID=
  pkill -f "parcel --port ${PARCEL_PORT}" 2>/dev/null || true
}

cleanup() {
  stop_children
  stop_parcel
}
trap cleanup EXIT INT TERM

# Parcel occasionally SIGABRTs on a corrupt LMDB .parcel-cache ("mutex lock failed").
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

resolve_dev_host() {
  if [ -n "${CAP_DEV_HOST:-}" ]; then
    echo "$CAP_DEV_HOST"
    return 0
  fi
  # Emulator-only Android: host loopback alias from the AVD network
  if [ "$DO_ANDROID" -eq 1 ]; then
    local devices avds
    devices=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1}')
    avds=$("$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null || true)
    if [ -z "$devices" ] && [ -n "$avds" ]; then
      echo "10.0.2.2"
      return 0
    fi
  fi
  detect_lan_ip || true
}

prep_cap_platform() {
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
}

launch_electron() {
  require_electron_shell
  if [ ! -x node_modules/.bin/electron ] && [ ! -f node_modules/electron/cli.js ]; then
    echo "Electron not installed — run: pnpm install" >&2
    exit 1
  fi
  echo "Starting Electron → http://127.0.0.1:${PARCEL_PORT}"
  pnpm exec electron . &
  CHILD_PIDS+=("$!")
}

launch_cap() {
  local platform="$1"
  echo "Starting ${platform} (Cap → http://${DEV_HOST}:${PARCEL_PORT})..."
  pnpm exec cap run "$platform" \
    --live-reload \
    --host "$DEV_HOST" \
    --port "$PARCEL_PORT" &
  CHILD_PIDS+=("$!")
}

# --- validate platform toolchains, then resolve HMR host ---

if [ "$DO_ELECTRON" -eq 1 ]; then
  require_electron_shell
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  require_java
  ensure_android_sdk
  require_adb
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
  prep_cap_platform android
fi

if [ "$DO_IOS" -eq 1 ]; then
  require_darwin "iOS start"
  require_xcode_for_capacitor_ios
  require_core_simulator
  require_cocoapods
  prep_cap_platform ios
fi

DEV_HOST="$(resolve_dev_host || true)"
if [ -z "$DEV_HOST" ]; then
  DEV_HOST=127.0.0.1
  if [ "$DO_ANDROID" -eq 1 ] || [ "$DO_IOS" -eq 1 ]; then
    echo "Could not detect machine LAN IP. Set CAP_DEV_HOST=<ip> and retry." >&2
    exit 1
  fi
  echo "No LAN IP detected — Parcel HMR host is 127.0.0.1 (local clients only)."
fi

echo "Starting Parcel on 0.0.0.0:${PARCEL_PORT} (HMR host ${DEV_HOST})..."
echo "  Local:  http://127.0.0.1:${PARCEL_PORT}"
if [ "$DEV_HOST" != "127.0.0.1" ] && [ "$DEV_HOST" != "10.0.2.2" ]; then
  echo "  LAN:    http://${DEV_HOST}:${PARCEL_PORT}"
fi
if ! start_parcel_ready \
  --host 0.0.0.0 \
  --port "$PARCEL_PORT" \
  --hmr-host "$DEV_HOST" \
  --hmr-port "$PARCEL_PORT"
then
  exit 1
fi

if [ "$DO_ELECTRON" -eq 1 ]; then
  launch_electron
fi
if [ "$DO_ANDROID" -eq 1 ]; then
  launch_cap android
fi
if [ "$DO_IOS" -eq 1 ]; then
  launch_cap ios
fi

echo "Parcel ready (pid ${PARCEL_PID}). Ctrl+C stops Parcel and attached clients."
# Stay up while Parcel runs; client exits alone should not tear down the host.
wait "$PARCEL_PID"
