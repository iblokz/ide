#!/usr/bin/env bash
# Install built artifacts (does not start a dev session).
#
# Usage:
#   ./bin/deploy.sh --app-image
#   ./bin/deploy.sh --android
#   ./bin/deploy.sh --macos
#   ./bin/deploy.sh --ios
#   ./bin/deploy.sh --build --macos   # build then install
#   ./bin/deploy.sh --all
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

DO_BUILD=0
DO_APP_IMAGE=0
DO_ANDROID=0
DO_MACOS=0
DO_IOS=0
USE_ALL=0

usage() {
  echo "Usage: $0 [--build] [--app-image] [--android] [--macos] [--ios] [--all] [--help]"
  echo ""
  echo "  Install packaged artifacts only (not a substitute for ./bin/start.sh)."
  echo "  If an artifact is missing, prompts to build it first (TTY); use --build to skip the prompt."
  echo ""
  echo "  --build     Run ./bin/build.sh for the same targets first"
  echo "  --app-image Install AppImage + .desktop → ~/.local"
  echo "  --android   adb install latest artifacts/android/*.apk"
  echo "  --macos     Install .app/.dmg → ~/Applications"
  echo "  --ios       Install simulator .app from artifacts/ios zip"
  echo "  --all       Capability-gated deploy for host candidates"
  echo ""
  echo "  Deprecated: --electron is an alias for --app-image (build/deploy only)."
}

for arg in "$@"; do
  case "$arg" in
    --build) DO_BUILD=1 ;;
    --app-image) DO_APP_IMAGE=1 ;;
    --electron)
      echo "Note: --electron is deprecated for packaging; use --app-image" >&2
      DO_APP_IMAGE=1
      ;;
    --android) DO_ANDROID=1 ;;
    --macos)   DO_MACOS=1 ;;
    --ios)     DO_IOS=1 ;;
    --all)
      USE_ALL=1
      if is_darwin; then
        DO_MACOS=1
        DO_IOS=1
        DO_ANDROID=1
        DO_APP_IMAGE=1
      else
        DO_APP_IMAGE=1
        DO_ANDROID=1
      fi
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

if [ "$DO_APP_IMAGE" -eq 0 ] && [ "$DO_ANDROID" -eq 0 ] && [ "$DO_MACOS" -eq 0 ] && [ "$DO_IOS" -eq 0 ]; then
  usage >&2
  exit 1
fi

maybe_skip() {
  local flag_var="$1"
  local target="$2"
  local check_fn="$3"
  if [ "$USE_ALL" -ne 1 ]; then
    return 0
  fi
  local reason
  if ! reason=$("$check_fn"); then
    skip_target "$target" "$reason" || true
    eval "$flag_var=0"
    return 1
  fi
  return 0
}

# Deploy soft-checks: android needs adb too; ios needs simctl/xcode
can_deploy_android() {
  local reason
  if ! reason=$(can_android); then
    echo "$reason"
    return 1
  fi
  if ! command -v adb &>/dev/null; then
    echo "adb not found"
    return 1
  fi
  return 0
}

can_deploy_ios() {
  local reason
  if ! reason=$(can_ios); then
    echo "$reason"
    return 1
  fi
  return 0
}

can_deploy_macos() {
  can_macos
}

can_deploy_app_image() {
  # Installing AppImage is most useful on Linux; still allow opening/building check
  if [ "$USE_ALL" -eq 1 ] && ! is_linux; then
    # On Darwin under --all, skip AppImage install (prefer --macos)
    echo "AppImage install skipped on non-Linux under --all (use --macos)"
    return 1
  fi
  can_app_image
}

has_app_image_artifact() {
  ls artifacts/electron/*.AppImage &>/dev/null
}

has_macos_artifact() {
  [ -n "$(find artifacts/macos -name '*.app' -type d 2>/dev/null | head -n1)" ] ||
    ls artifacts/macos/*.dmg &>/dev/null
}

has_android_artifact() {
  ls artifacts/android/*.apk &>/dev/null
}

has_ios_artifact() {
  ls artifacts/ios/*-ios-simulator.app.zip &>/dev/null
}

# Prompt (TTY) to build missing artifacts; non-TTY requires --build.
# Sets BUILD_NOW_ARGS (bash array of build.sh flags).
ensure_artifacts() {
  BUILD_NOW_ARGS=()
  local missing_labels=()

  if [ "$DO_BUILD" -eq 1 ]; then
    [ "$DO_APP_IMAGE" -eq 1 ] && BUILD_NOW_ARGS+=(--app-image)
    [ "$DO_ANDROID" -eq 1 ] && BUILD_NOW_ARGS+=(--android)
    [ "$DO_MACOS" -eq 1 ] && BUILD_NOW_ARGS+=(--macos)
    [ "$DO_IOS" -eq 1 ] && BUILD_NOW_ARGS+=(--ios)
    return 0
  fi

  if [ "$DO_APP_IMAGE" -eq 1 ] && ! has_app_image_artifact; then
    BUILD_NOW_ARGS+=(--app-image)
    missing_labels+=("app-image")
  fi
  if [ "$DO_MACOS" -eq 1 ] && ! has_macos_artifact; then
    BUILD_NOW_ARGS+=(--macos)
    missing_labels+=("macos")
  fi
  if [ "$DO_ANDROID" -eq 1 ] && ! has_android_artifact; then
    BUILD_NOW_ARGS+=(--android)
    missing_labels+=("android")
  fi
  if [ "$DO_IOS" -eq 1 ] && ! has_ios_artifact; then
    BUILD_NOW_ARGS+=(--ios)
    missing_labels+=("ios")
  fi

  if [ "${#BUILD_NOW_ARGS[@]}" -eq 0 ]; then
    return 0
  fi

  local label_list
  label_list=$(IFS=,; echo "${missing_labels[*]}")
  echo "No packaged artifact(s) for: ${label_list}"

  if [ ! -t 0 ]; then
    echo "Non-interactive shell — pass --build, or run: ./bin/build.sh ${BUILD_NOW_ARGS[*]}" >&2
    exit 1
  fi

  local ans=""
  # Default Yes
  read -r -p "Build now before deploy? [Y/n] " ans || true
  case "${ans:-Y}" in
    y|Y|yes|YES|"")
      ;;
    *)
      echo "Aborted. Build with: ./bin/build.sh ${BUILD_NOW_ARGS[*]}" >&2
      exit 1
      ;;
  esac
}

maybe_skip DO_APP_IMAGE app-image can_deploy_app_image || true
maybe_skip DO_MACOS macos can_deploy_macos || true
maybe_skip DO_ANDROID android can_deploy_android || true
maybe_skip DO_IOS ios can_deploy_ios || true

if [ "$DO_APP_IMAGE" -eq 0 ] && [ "$DO_ANDROID" -eq 0 ] && [ "$DO_MACOS" -eq 0 ] && [ "$DO_IOS" -eq 0 ]; then
  echo "deploy: no capable targets on this host." >&2
  exit 1
fi

BUILD_NOW_ARGS=()
ensure_artifacts

if [ "${#BUILD_NOW_ARGS[@]}" -gt 0 ]; then
  echo "Building: ${BUILD_NOW_ARGS[*]}"
  "$SCRIPT_DIR/build.sh" "${BUILD_NOW_ARGS[@]}"
fi

DEPLOYED_ANY=0

if [ "$DO_APP_IMAGE" -eq 1 ]; then
  APPIMAGE=$(ls -1t artifacts/electron/*.AppImage 2>/dev/null | head -n1 || true)
  if [ -z "$APPIMAGE" ]; then
    echo "No AppImage in artifacts/electron/ after build." >&2
    exit 1
  fi
  install_electron_appimage "$APPIMAGE"
  DEPLOYED_ANY=1
fi

if [ "$DO_MACOS" -eq 1 ]; then
  # electron-builder often nests .app under mac/ / mac-arm64/ / mac-universal/
  APP_BUNDLE=$(find artifacts/macos -name '*.app' -type d 2>/dev/null | head -n1 || true)
  DMG=$(ls -1t artifacts/macos/*.dmg 2>/dev/null | head -n1 || true)
  if [ -n "$APP_BUNDLE" ]; then
    install_electron_macos "$APP_BUNDLE"
  elif [ -n "$DMG" ]; then
    install_electron_macos "$DMG"
  else
    echo "No macOS artifact in artifacts/macos/ after build." >&2
    exit 1
  fi
  DEPLOYED_ANY=1
fi

if [ "$DO_ANDROID" -eq 1 ]; then
  require_adb
  APK=$(ls -1t artifacts/android/*.apk 2>/dev/null | head -n1 || true)
  if [ -z "$APK" ]; then
    echo "No APK in artifacts/android/ after build." >&2
    exit 1
  fi
  echo "Installing $APK ..."
  adb install -r "$APK"
  DEPLOYED_ANY=1
fi

if [ "$DO_IOS" -eq 1 ]; then
  ZIP=$(ls -1t artifacts/ios/*-ios-simulator.app.zip 2>/dev/null | head -n1 || true)
  if [ -z "$ZIP" ]; then
    echo "No iOS simulator zip in artifacts/ios/ after build." >&2
    exit 1
  fi
  require_darwin "iOS deploy"
  TMP=$(mktemp -d "${TMPDIR:-/tmp}/iblokz-ios-deploy.XXXXXX")
  trap 'rm -rf "$TMP"' EXIT
  unzip -q "$ZIP" -d "$TMP"
  APP_PATH=$(find "$TMP" -name '*.app' -type d | head -n1 || true)
  if [ -z "$APP_PATH" ]; then
    echo "No .app inside $ZIP" >&2
    exit 1
  fi
  # Boot default simulator if none booted.
  # Device names can contain parentheses (e.g. "iPhone SE (3rd generation)"), so extract UDIDs by UUID pattern.
  # Prefer plain "iPhone <n>" over "… (Nth generation)" so awk-era mistakes and flaky SE devices are avoided.
  BOOTED=$(xcrun simctl list devices | grep '(Booted)' | grep -Eo '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}' | head -n1 || true)
  if [ -z "$BOOTED" ]; then
    UDID=$(xcrun simctl list devices available | grep -E 'iPhone [0-9]' | grep -v generation | grep -v unavailable | grep -Eo '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}' | head -n1 || true)
    if [ -z "$UDID" ]; then
      UDID=$(xcrun simctl list devices available | grep -E 'iPhone' | grep -v unavailable | grep -Eo '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}' | head -n1 || true)
    fi
    if [ -z "$UDID" ]; then
      echo "No available iPhone simulator. Open Xcode → Window → Devices and Simulators." >&2
      exit 1
    fi
    echo "Booting simulator $UDID ..."
    xcrun simctl boot "$UDID" || true
    open -a Simulator
    # Wait briefly for boot before install (simctl install hangs if the runtime is still coming up).
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if xcrun simctl list devices | grep -q "$UDID.*(Booted)"; then
        break
      fi
      sleep 2
    done
    BOOTED="$UDID"
  fi
  echo "Installing $(basename "$APP_PATH") on $BOOTED ..."
  xcrun simctl install "$BOOTED" "$APP_PATH"
  BUNDLE_ID=$(defaults read "$APP_PATH/Info" CFBundleIdentifier 2>/dev/null || echo "org.iblokz.ide")
  xcrun simctl launch "$BOOTED" "$BUNDLE_ID" || true
  echo "Launched $BUNDLE_ID"
  DEPLOYED_ANY=1
fi

if [ "$DEPLOYED_ANY" -eq 0 ]; then
  echo "deploy: nothing deployed." >&2
  exit 1
fi

echo "deploy done."
