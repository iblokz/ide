#!/usr/bin/env bash
# Shared helpers for bin/ scripts.
# Source from a script that has set SCRIPT_DIR:
#   source "$SCRIPT_DIR/inc/common.sh"

stub_target() {
  local target="$1"
  local dir="$2"
  mkdir -p "$dir"
  echo "[stub] $target is not implemented yet (skeleton only)."
  echo "       Reserved output dir: $dir"
  echo "       See the IDE stack modernization plan for enabling this target."
  return 0
}

require_java() {
  local java_ver
  java_ver=$(java -version 2>&1) || true
  if [ -z "$java_ver" ] || echo "$java_ver" | grep -qi "unable to locate a java runtime\|no java runtime present"; then
    echo "Java (JDK) not found. Android build requires a JDK (OpenJDK 21)." >&2
    echo "Install examples:" >&2
    echo "  macOS (Homebrew):  brew install openjdk@21" >&2
    echo "  Linux (Debian/Ubuntu):  sudo apt install openjdk-21-jdk" >&2
    exit 1
  fi
}

require_adb() {
  if ! command -v adb &>/dev/null; then
    echo "adb not found. Android deploy requires platform-tools." >&2
    echo "  macOS: brew install android-platform-tools" >&2
    echo "  Linux: sudo apt install adb" >&2
    exit 1
  fi
}

require_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    echo "pnpm not found. Enable via: corepack enable && corepack prepare pnpm@latest --activate" >&2
    exit 1
  fi
}
