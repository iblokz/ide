#!/usr/bin/env bash
# Shared helpers for bin/ scripts.
# Source from a script that has set SCRIPT_DIR:
#   source "$SCRIPT_DIR/inc/common.sh"

is_darwin() {
  [ "$(uname -s)" = "Darwin" ]
}

is_linux() {
  [ "$(uname -s)" = "Linux" ]
}

# Soft skip under --all: print reason, return 1.
skip_target() {
  local target="$1"
  local reason="$2"
  echo "[skip] ${target}: ${reason}"
  return 1
}

hint_java_install() {
  echo "Install examples:" >&2
  echo "  macOS (MacPorts):  sudo port install openjdk21" >&2
  echo "  macOS (Homebrew):  brew install openjdk@21" >&2
  echo "  Linux (Debian/Ubuntu):  sudo apt install openjdk-21-jdk" >&2
}

hint_adb_install() {
  echo "  macOS (MacPorts):  sudo port install android-platform-tools" >&2
  echo "  macOS (Homebrew):  brew install android-platform-tools" >&2
  echo "  Linux (Debian/Ubuntu):  sudo apt install adb" >&2
}

hint_imagemagick_install() {
  echo "  macOS (MacPorts):  sudo port install ImageMagick" >&2
  echo "  macOS (Homebrew):  brew install imagemagick" >&2
  echo "  Linux (Debian/Ubuntu):  sudo apt install imagemagick" >&2
}

hint_cocoapods_install() {
  # No MacPorts cocoapods port. System Ruby (2.6) on Monterey often fails native gems.
  echo "  Prefer MacPorts Ruby 3.x, then gem:" >&2
  echo "    sudo port install ruby33 +yjit" >&2
  echo "    sudo port select --set ruby ruby33" >&2
  echo "    sudo gem install cocoapods" >&2
  echo "  Or Homebrew:  brew install cocoapods" >&2
  echo "  Avoid: sudo gem install with /usr/bin/ruby (Apple Ruby 2.6)" >&2
}

# Same hints on stdout (for init preflight reports).
hint_java_install_out() {
  echo "            macOS (MacPorts):  sudo port install openjdk21"
  echo "            macOS (Homebrew):  brew install openjdk@21"
  echo "            Linux (Debian/Ubuntu):  sudo apt install openjdk-21-jdk"
}

hint_adb_install_out() {
  echo "            macOS (MacPorts):  sudo port install android-platform-tools"
  echo "            macOS (Homebrew):  brew install android-platform-tools"
  echo "            Linux (Debian/Ubuntu):  sudo apt install adb"
}

hint_imagemagick_install_out() {
  echo "            macOS (MacPorts):  sudo port install ImageMagick"
  echo "            macOS (Homebrew):  brew install imagemagick"
  echo "            Linux (Debian/Ubuntu):  sudo apt install imagemagick"
}

hint_cocoapods_install_out() {
  echo "            sudo port install ruby33 && sudo port select --set ruby ruby33"
  echo "            sudo gem install cocoapods"
  echo "            or Homebrew: brew install cocoapods"
  echo "            (no MacPorts cocoapods port; avoid Apple /usr/bin/ruby)"
}

hint_android_sdk_out() {
  echo "            Set ANDROID_HOME, or install Android Studio / cmdline-tools"
  echo "            Typical path: ~/Library/Android/sdk  or  ~/Android/Sdk"
}

hint_xcode_out() {
  echo "            Install Xcode from the App Store, then: xcode-select --install"
}

# Capacitor 5 requires Xcode 14.1+. Cap 6+ needs Xcode 15 (not available on Monterey).
CAP_IOS_MIN_XCODE_MAJOR=14
CAP_IOS_MIN_XCODE_MINOR=1

hint_xcode_for_capacitor_ios() {
  echo "  Capacitor 5 iOS requires Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ (this host: $(xcodebuild -version 2>/dev/null | head -n1 || echo unknown))." >&2
  echo "  Install Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ from the App Store / developer.apple.com." >&2
}

hint_xcode_for_capacitor_ios_out() {
  echo "            Capacitor 5 needs Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ (this project uses Cap 5 for Monterey / Xcode 14.2)."
}

hint_core_simulator_out() {
  echo "            sudo xcodebuild -license accept"
  echo "            sudo xcodebuild -runFirstLaunch"
  echo "            (or open Xcode once and install additional components)"
  echo "            Then confirm: ls /Library/Developer/PrivateFrameworks/CoreSimulator.framework"
}

hint_core_simulator_install() {
  echo "  sudo xcodebuild -license accept" >&2
  echo "  sudo xcodebuild -runFirstLaunch" >&2
  echo "  Or open Xcode once and let it install components." >&2
  echo "  Confirm: ls /Library/Developer/PrivateFrameworks/CoreSimulator.framework" >&2
}

has_imagemagick() {
  command -v convert &>/dev/null
}

# Returns 0 if a usable JDK is on PATH.
has_java() {
  local java_ver
  java_ver=$(java -version 2>&1) || true
  if [ -z "$java_ver" ] || echo "$java_ver" | grep -qi "unable to locate a java runtime\|no java runtime present"; then
    return 1
  fi
  return 0
}

# Locate Android SDK without exiting. Sets ANDROID_HOME / ANDROID_SDK_ROOT on success.
find_android_sdk() {
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
    /usr/lib/android-sdk \
    /opt/local/share/java/android-sdk
  do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      return 0
    fi
  done
  return 1
}

# Prefer an existing SDK; Capacitor/Gradle need ANDROID_HOME (or ANDROID_SDK_ROOT).
ensure_android_sdk() {
  if find_android_sdk; then
    return 0
  fi
  echo "Android SDK not found. Set ANDROID_HOME or install Android Studio / cmdline-tools." >&2
  echo "  Typical path: ~/Android/Sdk  or  ~/Library/Android/sdk" >&2
  exit 1
}

has_electron_shell() {
  [ -f "${PROJECT_ROOT:-.}/electron/main.js" ] &&
    [ -f "${PROJECT_ROOT:-.}/electron/preload.js" ] &&
    [ -d "${PROJECT_ROOT:-.}/node_modules/electron" ]
}

has_electron_builder() {
  [ -d "${PROJECT_ROOT:-.}/node_modules/electron-builder" ] ||
    [ -x "${PROJECT_ROOT:-.}/node_modules/.bin/electron-builder" ]
}

has_xcode() {
  command -v xcodebuild &>/dev/null && xcodebuild -version &>/dev/null
}

# Major.minor from "Xcode 14.2" → major=14 minor=2. Empty major if unparsable.
xcode_version_parts() {
  local ver major minor
  ver=$(xcodebuild -version 2>/dev/null | head -n1 | awk '{print $2}')
  major=${ver%%.*}
  if [ "$ver" = "$major" ]; then
    minor=0
  else
    minor=${ver#*.}
    minor=${minor%%.*}
  fi
  case "$major" in
    ''|*[!0-9]*) echo "" ;;
    *)
      case "$minor" in
        ''|*[!0-9]*) minor=0 ;;
      esac
      echo "$major $minor"
      ;;
  esac
}

xcode_major_version() {
  local parts
  parts=$(xcode_version_parts)
  echo "${parts%% *}"
}

# Capacitor 5 (@capacitor/ios) needs Xcode 14.1+.
has_xcode_for_capacitor_ios() {
  local parts major minor
  parts=$(xcode_version_parts)
  [ -n "$parts" ] || return 1
  major=${parts%% *}
  minor=${parts#* }
  if [ "$major" -gt "$CAP_IOS_MIN_XCODE_MAJOR" ]; then
    return 0
  fi
  if [ "$major" -eq "$CAP_IOS_MIN_XCODE_MAJOR" ] && [ "$minor" -ge "$CAP_IOS_MIN_XCODE_MINOR" ]; then
    return 0
  fi
  return 1
}

# Xcode.app can be present while first-launch packages (CoreSimulator) were never installed.
has_core_simulator() {
  [ -d /Library/Developer/PrivateFrameworks/CoreSimulator.framework ]
}

has_cocoapods() {
  command -v pod &>/dev/null
}

# Soft capability checks (return 0 = capable). On failure, print reason to stdout via skip helper caller.
# Usage: can_app_image || true — sets CAN_*_REASON when failing if you call check_* that echo reason.
can_app_image() {
  if ! has_electron_shell; then
    echo "Electron shell or node_modules/electron missing (pnpm install / ./bin/init.sh --electron)"
    return 1
  fi
  if ! has_electron_builder; then
    echo "electron-builder not installed (pnpm install)"
    return 1
  fi
  return 0
}

can_macos() {
  if ! is_darwin; then
    echo "macOS DMG packaging requires Darwin"
    return 1
  fi
  if ! has_electron_shell; then
    echo "Electron shell or node_modules/electron missing (pnpm install / ./bin/init.sh --electron)"
    return 1
  fi
  if ! has_electron_builder; then
    echo "electron-builder not installed (pnpm install)"
    return 1
  fi
  if ! has_xcode; then
    echo "xcodebuild not available (install Xcode / Command Line Tools)"
    return 1
  fi
  return 0
}

# Cap Android/iOS inject the bridge by splicing after <head> or before </head>.
# Parcel's HTML minify drops optional <head>/<body>, so packaged apps log
# "Unable to inject Capacitor, Plugins won't work" and Open Project falls back
# to the inert web <input> path. Live-reload serves unminified HTML, so it works.
ensure_capacitor_index_html() {
  local html="${1:-dist/index.html}"
  [ -f "$html" ] || return 0
  python3 - "$html" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
if '<head>' in text or '</head>' in text:
    sys.exit(0)
m = re.match(r'(<!DOCTYPE\s+html>\s*<html\b[^>]*>)(.*)\Z', text, re.I | re.S)
if not m:
    print(f'Warning: could not patch {path} for Capacitor </head> inject', file=sys.stderr)
    sys.exit(0)
open(path, 'w', encoding='utf-8').write(
    f'{m.group(1)}<head>{m.group(2)}</head><body></body>'
)
print(f'Patched {path} for Capacitor bridge inject (<head>)')
PY
}

# Cap sync / native packaging need ImageMagick for assets — used by build.sh --all.
can_android() {
  if ! has_java; then
    echo "JDK not found (OpenJDK 21 recommended)"
    return 1
  fi
  if ! find_android_sdk; then
    echo "Android SDK not found (set ANDROID_HOME or install Android Studio / cmdline-tools)"
    return 1
  fi
  if ! has_imagemagick; then
    echo "ImageMagick 'convert' not found (needed for Cap web/assets build)"
    return 1
  fi
  return 0
}

# Init only needs the native toolchain (no web build).
can_android_init() {
  if ! has_java; then
    echo "JDK not found (OpenJDK 21 recommended)"
    return 1
  fi
  if ! find_android_sdk; then
    echo "Android SDK not found (set ANDROID_HOME or install Android Studio / cmdline-tools)"
    return 1
  fi
  return 0
}

can_ios() {
  if ! is_darwin; then
    echo "iOS requires Darwin + Xcode"
    return 1
  fi
  if ! has_xcode; then
    echo "xcodebuild not available (install Xcode)"
    return 1
  fi
  if ! has_xcode_for_capacitor_ios; then
    echo "Capacitor 5 needs Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ (found $(xcodebuild -version 2>/dev/null | head -n1))"
    return 1
  fi
  if ! has_core_simulator; then
    echo "CoreSimulator.framework missing (run: sudo xcodebuild -runFirstLaunch)"
    return 1
  fi
  if ! has_cocoapods; then
    echo "CocoaPods (pod) not found"
    return 1
  fi
  if ! has_imagemagick; then
    echo "ImageMagick 'convert' not found (needed for Cap web/assets build)"
    return 1
  fi
  if [ ! -f "${PROJECT_ROOT:-.}/capacitor.config.json" ] && [ ! -f "${PROJECT_ROOT:-.}/capacitor.config.ts" ]; then
    echo "Missing capacitor.config.json"
    return 1
  fi
  return 0
}

can_ios_init() {
  if ! is_darwin; then
    echo "iOS requires Darwin + Xcode"
    return 1
  fi
  if ! has_xcode; then
    echo "xcodebuild not available (install Xcode)"
    return 1
  fi
  if ! has_xcode_for_capacitor_ios; then
    echo "Capacitor 5 needs Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ (found $(xcodebuild -version 2>/dev/null | head -n1))"
    return 1
  fi
  if ! has_core_simulator; then
    echo "CoreSimulator.framework missing (run: sudo xcodebuild -runFirstLaunch)"
    return 1
  fi
  if ! has_cocoapods; then
    echo "CocoaPods (pod) not found"
    return 1
  fi
  if [ ! -f "${PROJECT_ROOT:-.}/capacitor.config.json" ] && [ ! -f "${PROJECT_ROOT:-.}/capacitor.config.ts" ]; then
    echo "Missing capacitor.config.json"
    return 1
  fi
  return 0
}

require_java() {
  if ! has_java; then
    echo "Java (JDK) not found. Android build requires a JDK (OpenJDK 21)." >&2
    hint_java_install
    exit 1
  fi
}

require_adb() {
  if ! command -v adb &>/dev/null; then
    echo "adb not found. Android deploy requires platform-tools." >&2
    hint_adb_install
    exit 1
  fi
}

require_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    echo "pnpm not found. Enable via: corepack enable && corepack prepare pnpm@latest --activate" >&2
    exit 1
  fi
}

require_xcode() {
  if ! has_xcode; then
    echo "xcodebuild not found or Xcode is not usable." >&2
    echo "  Install Xcode from the App Store, then: xcode-select --install" >&2
    exit 1
  fi
}

require_xcode_for_capacitor_ios() {
  require_xcode
  if ! has_xcode_for_capacitor_ios; then
    hint_xcode_for_capacitor_ios
    exit 1
  fi
}

require_core_simulator() {
  if ! has_core_simulator; then
    echo "CoreSimulator.framework missing — Xcode first-launch packages not installed." >&2
    hint_core_simulator_install
    exit 1
  fi
}

require_cocoapods() {
  if ! has_cocoapods; then
    echo "CocoaPods (pod) not found. iOS requires CocoaPods." >&2
    hint_cocoapods_install
    exit 1
  fi
}

require_imagemagick() {
  if ! has_imagemagick; then
    echo "ImageMagick 'convert' not found (needed for favicons / native assets)." >&2
    hint_imagemagick_install
    exit 1
  fi
}

# Init preflight: print [ok]/[missing] for OS deps of selected targets, with install hints.
# Reads DO_* / USE_ALL from caller. Under USE_ALL, clears DO_* for incapable targets.
# Under explicit flags, exits 1 if any required OS dep for a selected target is missing.
# Expects PROJECT_ROOT set.
preflight_os_deps() {
  local need_imagemagick=0 need_java=0 need_sdk=0 need_xcode=0 need_pods=0 need_simulator=0
  local hard_fail=0

  [ "${DO_ANDROID:-0}" -eq 1 ] && need_java=1 && need_sdk=1
  [ "${DO_IOS:-0}" -eq 1 ] && need_xcode=1 && need_pods=1 && need_simulator=1
  # Packaging later needs assets — alert for desktop packagers (init itself does not build)
  [ "${DO_MACOS:-0}" -eq 1 ] && need_imagemagick=1 && need_xcode=1
  [ "${DO_APP_IMAGE:-0}" -eq 1 ] && need_imagemagick=1

  echo ""
  echo "OS dependencies:"

  # Shared / always useful
  if command -v pnpm &>/dev/null; then
    echo "  [ok]      pnpm ($(pnpm -v 2>/dev/null || echo present))"
  else
    echo "  [missing] pnpm — corepack enable && corepack prepare pnpm@latest --activate"
    hard_fail=1
  fi

  if [ "$need_imagemagick" -eq 1 ]; then
    if has_imagemagick; then
      echo "  [ok]      ImageMagick (convert)"
    else
      echo "  [missing] ImageMagick (convert) — required before ./bin/build.sh (assets)"
      hint_imagemagick_install_out
      echo "            (Electron shell init can continue)"
    fi
  fi

  if [ "$need_java" -eq 1 ]; then
    if has_java; then
      echo "  [ok]      Java (JDK)"
    else
      echo "  [missing] Java (JDK) — Android requires OpenJDK 21"
      hint_java_install_out
      hard_fail=1
    fi
  fi

  if [ "$need_sdk" -eq 1 ]; then
    if find_android_sdk; then
      echo "  [ok]      Android SDK ($ANDROID_HOME)"
    else
      echo "  [missing] Android SDK (ANDROID_HOME)"
      hint_android_sdk_out
      hard_fail=1
    fi
  fi

  if [ "$need_xcode" -eq 1 ]; then
    if is_darwin && has_xcode; then
      # iOS (need_simulator) needs Cap 6 / Xcode 15+; macOS packaging can use older Xcode.
      if [ "$need_simulator" -eq 1 ] && ! has_xcode_for_capacitor_ios; then
        echo "  [missing] Xcode ${CAP_IOS_MIN_XCODE_MAJOR}.${CAP_IOS_MIN_XCODE_MINOR}+ for Capacitor 5 iOS (found $(xcodebuild -version 2>/dev/null | head -n1))"
        hint_xcode_for_capacitor_ios_out
        hard_fail=1
      else
        echo "  [ok]      Xcode ($(xcodebuild -version 2>/dev/null | head -n1))"
      fi
    elif ! is_darwin; then
      echo "  [missing] Xcode — requires macOS (Darwin)"
      hard_fail=1
    else
      echo "  [missing] Xcode / xcodebuild"
      hint_xcode_out
      hard_fail=1
    fi
  fi

  if [ "$need_simulator" -eq 1 ]; then
    if has_core_simulator; then
      echo "  [ok]      CoreSimulator"
    else
      echo "  [missing] CoreSimulator — Xcode first-launch packages not installed"
      hint_core_simulator_out
      hard_fail=1
    fi
  fi

  if [ "$need_pods" -eq 1 ]; then
    if has_cocoapods; then
      echo "  [ok]      CocoaPods ($(pod --version 2>/dev/null || echo present))"
    else
      echo "  [missing] CocoaPods (pod) — required for iOS"
      hint_cocoapods_install_out
      hard_fail=1
    fi
  fi

  # Optional but useful for android deploy later
  if [ "${DO_ANDROID:-0}" -eq 1 ]; then
    if command -v adb &>/dev/null; then
      echo "  [ok]      adb"
    else
      echo "  [alert]   adb not found — Android init can continue; deploy needs platform-tools"
      hint_adb_install_out
    fi
  fi

  echo ""

  if [ "${USE_ALL:-0}" -eq 1 ]; then
    local reason
    if [ "${DO_ANDROID:-0}" -eq 1 ]; then
      if ! reason=$(can_android_init); then
        skip_target "android" "$reason" || true
        DO_ANDROID=0
      fi
    fi
    if [ "${DO_IOS:-0}" -eq 1 ]; then
      if ! reason=$(can_ios_init); then
        skip_target "ios" "$reason" || true
        DO_IOS=0
      fi
    fi
    if [ "${DO_MACOS:-0}" -eq 1 ]; then
      if ! reason=$(can_macos); then
        skip_target "macos" "$reason" || true
        DO_MACOS=0
      fi
    fi
    if [ "${DO_APP_IMAGE:-0}" -eq 1 ]; then
      if ! reason=$(can_app_image); then
        skip_target "app-image" "$reason" || true
        DO_APP_IMAGE=0
      fi
    fi
    if ! has_imagemagick; then
      if [ "${DO_APP_IMAGE:-0}" -eq 1 ] || [ "${DO_MACOS:-0}" -eq 1 ]; then
        echo "[alert] install ImageMagick before ./bin/build.sh --app-image / --macos (assets)"
      fi
    fi
    return 0
  fi

  # Explicit targets: fail fast after the full report
  if [ "$hard_fail" -eq 1 ]; then
    echo "Fix the missing OS dependencies above, then re-run init." >&2
    exit 1
  fi
}

require_darwin() {
  local for_what="${1:-this target}"
  if ! is_darwin; then
    echo "${for_what} requires macOS (Darwin)." >&2
    exit 1
  fi
}

require_electron_shell() {
  if [ ! -f "${PROJECT_ROOT:-.}/electron/main.js" ] || [ ! -f "${PROJECT_ROOT:-.}/electron/preload.js" ]; then
    echo "Missing electron/main.js or preload.js" >&2
    exit 1
  fi
  if [ ! -d "${PROJECT_ROOT:-.}/node_modules/electron" ]; then
    echo "Electron package missing — run: pnpm install" >&2
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

# Install a macOS .app into ~/Applications (parallel to Linux AppImage → ~/.local).
# Accepts a .app bundle path or a .dmg (attaches, copies .app, detaches).
# Usage: install_electron_macos /path/to/App.app|/path/to.dmg
install_electron_macos() {
  local artifact="$1"
  local apps_dir="${HOME}/Applications"
  local product_name="iBloKz IDE"
  local dest="${apps_dir}/${product_name}.app"
  local mount="" app_src="" detach=0

  if [ -z "$artifact" ]; then
    echo "No macOS artifact path given" >&2
    return 1
  fi

  mkdir -p "$apps_dir"

  if [ -d "$artifact" ] && [[ "$artifact" == *.app ]]; then
    app_src="$artifact"
  elif [ -f "$artifact" ] && [[ "$artifact" == *.dmg ]]; then
    echo "Attaching DMG: $artifact"
    # -nobrowse avoids Finder popups; parse mount point from hdiutil output
    mount=$(hdiutil attach -nobrowse -readonly "$artifact" | awk 'END {print $NF}')
    if [ -z "$mount" ] || [ ! -d "$mount" ]; then
      echo "Failed to attach DMG" >&2
      return 1
    fi
    detach=1
    app_src=$(find "$mount" -maxdepth 2 -name '*.app' -type d | head -n1 || true)
    if [ -z "$app_src" ]; then
      echo "No .app found inside DMG" >&2
      hdiutil detach "$mount" -quiet 2>/dev/null || true
      return 1
    fi
  else
    echo "Unrecognized macOS artifact: $artifact" >&2
    return 1
  fi

  # Prefer product name destination so upgrades replace a stable path
  local app_basename
  app_basename="$(basename "$app_src")"
  if [ "$app_basename" != "${product_name}.app" ]; then
    dest="${apps_dir}/${app_basename}"
  fi

  echo "Installing $(basename "$app_src") → $dest"
  rm -rf "$dest"
  # ditto preserves resource forks / signing metadata better than cp -R
  if command -v ditto &>/dev/null; then
    ditto "$app_src" "$dest"
  else
    cp -R "$app_src" "$dest"
  fi

  if [ "$detach" -eq 1 ] && [ -n "$mount" ]; then
    hdiutil detach "$mount" -quiet 2>/dev/null || hdiutil detach "$mount" -force -quiet 2>/dev/null || true
  fi

  # Local unsigned builds: clear quarantine so Gatekeeper does not block first launch
  if command -v xattr &>/dev/null; then
    xattr -dr com.apple.quarantine "$dest" 2>/dev/null || true
  fi

  echo "Installed → $dest"
  return 0
}

# Prefer a Wi‑Fi/Ethernet LAN IPv4 (skip VPN/docker/loopback).
detect_lan_ip() {
  local ip="" iface=""

  # Darwin: prefer common Wi‑Fi/Ethernet interfaces
  if is_darwin; then
    for iface in en0 en1 en2 en3; do
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
      if [ -n "$ip" ] && [[ "$ip" != 127.* ]]; then
        echo "$ip"
        return 0
      fi
    done
    if command -v ifconfig &>/dev/null; then
      ip=$(ifconfig 2>/dev/null | awk '
        /^[a-z]/ { iface=$1; sub(/:$/, "", iface) }
        iface ~ /^(lo|bridge|awdl|llw|utun|gif|stf)/ { next }
        /inet / {
          split($2, a, " ");
          ip=a[1];
          if (ip ~ /^127\./) next;
          if (ip ~ /^10\./ || ip ~ /^192\.168\./ || ip ~ /^172\.(1[7-9]|2[0-9]|3[0-1])\./) {
            print ip;
            exit
          }
        }')
      if [ -n "$ip" ]; then
        echo "$ip"
        return 0
      fi
    fi
  fi

  # Linux: Common host NICs first
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
    # Any global private IPv4 not on tun/wg/docker/br/veth
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

# iOS document picker needs in-place document access for security-scoped bookmarks.
ensure_ios_document_picker() {
  local plist="ios/App/App/Info.plist"
  if [ ! -f "$plist" ]; then
    return 0
  fi
  if grep -q 'LSSupportsOpeningDocumentsInPlace' "$plist"; then
    return 0
  fi
  python3 - "$plist" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
needle = '\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<true/>\n'
insert = (
    needle
    + '\t<key>LSSupportsOpeningDocumentsInPlace</key>\n\t<true/>\n'
    + '\t<key>UISupportsDocumentBrowser</key>\n\t<false/>\n'
)
if needle not in text:
    print(f'Warning: could not patch {path} for document picker', file=sys.stderr)
    sys.exit(1)
open(path, 'w', encoding='utf-8').write(text.replace(needle, insert, 1))
print(f'Enabled LSSupportsOpeningDocumentsInPlace on {path}')
PY
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

# Cap 5 template ships Gradle 8.0.2 + AGP 8.0.0:
# - Gradle 8.0.x cannot *run* on JDK 21 (class file major 65)
# - AGP 8.0.x fails JdkImageTransform/jlink on JDK 21 (androidJdkImage)
# Bump both so CI (Temurin 21) and MacPorts openjdk21 keep working.
ANDROID_GRADLE_WRAPPER_TARGET=8.5
ANDROID_AGP_TARGET=8.2.2

ensure_android_gradle_for_jdk() {
  local props="android/gradle/wrapper/gradle-wrapper.properties"
  local root_gradle="android/build.gradle"
  if [ -f "$props" ]; then
    python3 - "$props" "$ANDROID_GRADLE_WRAPPER_TARGET" <<'PY'
import re, sys
path, target = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8').read()
m = re.search(r'gradle-(\d+)\.(\d+)(?:\.(\d+))?-all\.zip', text)
if not m:
    sys.exit(0)
major, minor = int(m.group(1)), int(m.group(2))
# Need Gradle 8.5+ to execute on JDK 21
changed = False
if not (major > 8 or (major == 8 and minor >= 5)):
    text = re.sub(
        r'gradle-\d+\.\d+(?:\.\d+)?-all\.zip',
        f'gradle-{target}-all.zip',
        text,
        count=1,
    )
    changed = True
    print(f'Bumped Android Gradle wrapper to {target} (JDK 21 needs Gradle 8.5+)')
# Cap templates ship networkTimeout=10000; too short for ~180MB gradle-*-all.zip
m_to = re.search(r'^networkTimeout=(\d+)\s*$', text, re.M)
if not m_to or int(m_to.group(1)) < 120000:
    if m_to:
        text = re.sub(r'^networkTimeout=\d+\s*$', 'networkTimeout=120000', text, count=1, flags=re.M)
    else:
        text = text.rstrip() + '\nnetworkTimeout=120000\n'
    changed = True
    print('Raised Gradle wrapper networkTimeout to 120000ms')
if changed:
    open(path, 'w', encoding='utf-8').write(text)
PY
  fi
  if [ -f "$root_gradle" ]; then
    python3 - "$root_gradle" "$ANDROID_AGP_TARGET" <<'PY'
import re, sys
path, target = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8').read()
m = re.search(
    r"classpath\s+['\"]com\.android\.tools\.build:gradle:(\d+)\.(\d+)\.(\d+)['\"]",
    text,
)
if not m:
    sys.exit(0)
major, minor = int(m.group(1)), int(m.group(2))
# AGP 8.2+ avoids JDK 21 jlink/androidJdkImage failures with Cap 5 templates
if major > 8 or (major == 8 and minor >= 2):
    sys.exit(0)
new, n = re.subn(
    r"(classpath\s+['\"]com\.android\.tools\.build:gradle:)\d+\.\d+\.\d+(['\"])",
    rf"\g<1>{target}\2",
    text,
    count=1,
)
if n:
    open(path, 'w', encoding='utf-8').write(new)
    print(f'Bumped Android Gradle Plugin to {target} (JDK 21 needs AGP 8.2+)')
PY
  fi
  # Cap's `runTask('Running Gradle build')` spinner swallows ./gradlew stdout, so a
  # first-time ~200MB wrapper download looks hung. Prefetch with visible output.
  ensure_android_gradle_distribution
}

# Download/extract the Gradle wrapper distribution if missing (visible progress).
ensure_android_gradle_distribution() {
  local props="android/gradle/wrapper/gradle-wrapper.properties"
  [ -f "$props" ] || return 0
  [ -f android/gradlew ] || return 0
  chmod +x android/gradlew 2>/dev/null || true

  local gradle_home="${GRADLE_USER_HOME:-$HOME/.gradle}"
  local zip
  zip="$(sed -n 's/^distributionUrl=.*\/\(gradle-[^[:space:]]*\.zip\)[[:space:]]*$/\1/p' "$props" | tr -d '\\' | head -1)"
  [ -n "$zip" ] || return 0
  local dist="${zip%.zip}"

  if compgen -G "${gradle_home}/wrapper/dists/${dist}/*/${zip}.ok" > /dev/null 2>&1; then
    return 0
  fi
  # Extracted tree without .ok still usable
  if compgen -G "${gradle_home}/wrapper/dists/${dist}/*/gradle-*/lib/gradle-launcher-*.jar" > /dev/null 2>&1; then
    return 0
  fi

  local part
  part="$(compgen -G "${gradle_home}/wrapper/dists/${dist}/*/${zip}.part" || true)"
  if [ -n "$part" ]; then
    local have total pct
    have="$(wc -c < "$part" | tr -d ' ')"
    # gradle-*-all.zip is ~200MB; show partial size so the wait is less opaque
    echo "Gradle ${dist}: resuming download ($(numfmt --to=iec-i --suffix=B "$have" 2>/dev/null || echo "${have} bytes") so far; full zip ~200MiB)..."
  else
    echo "Gradle ${dist}: downloading wrapper distribution (~200MiB, one-time)..."
  fi
  echo "(Prefetching here because Capacitor hides Gradle output under \"Running Gradle build\".)"
  (cd android && ./gradlew --version)
}

# Resolve Xcode entry for Capacitor ios/App (workspace vs project).
ios_xcode_entry() {
  if [ -d ios/App/App.xcworkspace ]; then
    echo "-workspace ios/App/App.xcworkspace"
  elif [ -d ios/App/App.xcodeproj ]; then
    echo "-project ios/App/App.xcodeproj"
  else
    return 1
  fi
}
