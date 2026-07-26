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

# Install a built AppImage + .desktop entry for the current user (XDG).
# Usage: install_electron_appimage /path/to/app.AppImage
# Expects PROJECT_ROOT set (bin scripts set this before sourcing).
install_electron_appimage() {
  local appimage="$1"
  local app_id="org.iblokz.ide"
  local product_name="iBloKz IDE"
  local data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  local bin_home="${XDG_BIN_HOME:-$HOME/.local/bin}"
  local install_dir="$data_home/iblokz-ide"
  local apps_dir="$data_home/applications"
  local icons_dir="$data_home/icons/hicolor/512x512/apps"
  local installed="$install_dir/iblokz-ide.AppImage"
  local desktop_file="$apps_dir/${app_id}.desktop"
  local icon_dst="$icons_dir/${app_id}.png"
  local icon_src="${PROJECT_ROOT:-.}/build/assets/icons/icon-512.png"
  local bin_link="$bin_home/iblokz-ide"

  if [ -z "$appimage" ] || [ ! -f "$appimage" ]; then
    echo "AppImage not found: ${appimage:-}" >&2
    return 1
  fi

  mkdir -p "$install_dir" "$apps_dir" "$icons_dir" "$bin_home"
  # Resolve to absolute path so hardlinks / desktop Exec= are stable.
  appimage="$(cd "$(dirname "$appimage")" && pwd)/$(basename "$appimage")"
  chmod +x "$appimage"
  # Same FS → hardlink; else symlink (Projects vs ~/.local); else copy.
  rm -f "$installed"
  if ln -f "$appimage" "$installed" 2>/dev/null; then
    :
  elif ln -sfn "$appimage" "$installed" 2>/dev/null; then
    :
  else
    cp -f "$appimage" "$installed"
    chmod +x "$installed"
  fi

  if [ -f "$icon_src" ]; then
    cp -f "$icon_src" "$icon_dst"
  else
    echo "Warning: icon missing at $icon_src — desktop entry will use generic icon" >&2
  fi

  ln -sfn "$installed" "$bin_link"

  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=${product_name}
Comment=iBloKz in-browser / desktop code editor
Exec=${installed}
Icon=${app_id}
Terminal=false
Categories=Development;IDE;
# Must match Electron Linux WM_CLASS (executable basename from package.json name).
StartupWMClass=iblokz-ide
StartupNotify=true
EOF
  chmod 644 "$desktop_file"

  if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$apps_dir" 2>/dev/null || true
  fi
  if command -v gtk-update-icon-cache &>/dev/null && [ -d "$data_home/icons/hicolor" ]; then
    gtk-update-icon-cache -f -t "$data_home/icons/hicolor" 2>/dev/null || true
  fi

  echo "Installed AppImage → $installed"
  echo "Desktop entry     → $desktop_file"
  echo "Launcher symlink  → $bin_link"
}

# Prefer an existing SDK; Capacitor/Gradle need ANDROID_HOME (or ANDROID_SDK_ROOT).
ensure_android_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    return 0
  fi
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
    return 0
  fi
  local candidate
  for candidate in \
    "$HOME/Android/Sdk" \
    "$HOME/Library/Android/sdk" \
    /usr/lib/android-sdk
  do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      echo "Using Android SDK at $ANDROID_HOME"
      return 0
    fi
  done
  echo "Android SDK not found. Set ANDROID_HOME or install Android Studio / cmdline-tools." >&2
  echo "  Typical path: ~/Android/Sdk" >&2
  exit 1
}

# Prefer a Wi‑Fi/Ethernet LAN IPv4 (skip VPN/docker/loopback).
detect_lan_ip() {
  local ip="" iface=""
  # 1) Explicit override already handled by caller via CAP_DEV_HOST
  # 2) Common host NICs first
  if command -v ip &>/dev/null; then
    for iface in wlan0 wlp wlp0s wlp1s wlp2s eth0 enp ens eno; do
      ip=$(ip -4 -o addr show 2>/dev/null | awk -v re="^[^ ]+ +${iface}" '
        $0 ~ re {
          split($4, a, "/");
          print a[1];
          exit
        }')
      # partial match for wlp*/enp*
      if [ -z "$ip" ]; then
        ip=$(ip -4 -o addr show 2>/dev/null | awk -v p="$iface" '
          $2 ~ ("^" p) {
            split($4, a, "/");
            print a[1];
            exit
          }')
      fi
      if [ -n "$ip" ] && [[ "$ip" != 127.* ]]; then
        echo "$ip"
        return 0
      fi
    done
    # 3) Any global private IPv4 not on tun/wg/docker/br/veth
    ip=$(ip -4 -o addr show scope global 2>/dev/null | awk '
      $2 ~ /^(lo|docker|br-|veth|tun|wg|tailscale|zt)/ { next }
      {
        split($4, a, "/");
        print a[1];
        exit
      }')
    if [ -n "$ip" ] && [[ "$ip" != 127.* ]]; then
      echo "$ip"
      return 0
    fi
  fi
  if command -v hostname &>/dev/null; then
    ip=$(hostname -I 2>/dev/null | tr ' ' '\n' | awk '
      /^127\./ { next }
      /^172\.(1[7-9]|2[0-9]|3[0-1])\./ { next }
      /^10\.|^192\.168\./ { print; exit }
    ')
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  fi
  return 1
}

# Cap server.cleartext only patches Cordova manifests; ensure the app Manifest allows HTTP/WS.
ensure_android_cleartext() {
  local manifest="android/app/src/main/AndroidManifest.xml"
  if [ ! -f "$manifest" ]; then
    return 0
  fi
  if grep -q 'android:usesCleartextTraffic=' "$manifest"; then
    return 0
  fi
  python3 - "$manifest" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
new, n = re.subn(
    r'(<application\b)([^>]*)(>)',
    r'\1\2 android:usesCleartextTraffic="true"\3',
    text,
    count=1,
    flags=re.DOTALL,
)
if n:
    open(path, 'w', encoding='utf-8').write(new)
    print(f'Enabled android:usesCleartextTraffic on {path}')
else:
    print(f'Warning: could not patch {path} for cleartext', file=sys.stderr)
    sys.exit(1)
PY
}
