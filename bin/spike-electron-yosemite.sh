#!/usr/bin/env bash
# Find an Electron x64 that can loadFile() HTML on Yosemite (not just data: URLs).
#
# Usage:
#   ./bin/spike-electron-yosemite.sh              # Electron 11.x ladder (older first), then 10→4
#   ./bin/spike-electron-yosemite.sh 11.0.0       # one version
#   ./bin/spike-electron-yosemite.sh --majors     # skip 11.x patches; majors only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"

SPIKE_ROOT="${PROJECT_ROOT}/artifacts/electron-spike"
REMOTE_REL="iblokz-electron-spike"
MARKER_REMOTE="/tmp/iblokz-spike-loaded.txt"

HOST=$(resolve_deploy_host "")
VERSIONS=()
MODE=11x

while [ $# -gt 0 ]; do
  case "$1" in
    --majors) MODE=majors; shift ;;
    --host)
      HOST=$(resolve_deploy_host "${2:-}")
      shift 2
      ;;
    --host=*)
      HOST=$(resolve_deploy_host "${1#--host=}")
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--majors] [--host user@ip] [version]"
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9] ]]; then
        VERSIONS=("$1")
      else
        HOST=$(resolve_deploy_host "$1")
      fi
      shift
      ;;
  esac
done

if [ "${#VERSIONS[@]}" -eq 0 ]; then
  if [ "$MODE" = majors ]; then
    VERSIONS=(11.0.0 10.4.7 9.4.4 8.5.5 7.3.3 6.1.12 5.0.13 4.2.12)
  else
    # Older 11.x first — 11.5.0 boots but loadFile hangs on 10.10.5
    VERSIONS=(11.0.0 11.1.1 11.2.3 11.3.0 11.4.12 11.5.0 10.4.7 9.4.4 8.5.5)
  fi
fi

echo "Spike host: $HOST"
echo "Criterion: loadFile(index.html) → did-finish-load (marker file)"
echo "Versions: ${VERSIONS[*]}"
mkdir -p "$SPIKE_ROOT"

make_minimal_app() {
  local app_dir="$1"
  local resources="$app_dir/Contents/Resources"
  local app_dir_res="$resources/app"
  mkdir -p "$app_dir_res"
  cat >"$app_dir_res/package.json" <<'EOF'
{"name":"iblokz-electron-spike","main":"main.js","version":"0.0.0"}
EOF
  # Real file load — data: URLs were a false positive on 11.5.0
  cat >"$app_dir_res/index.html" <<'EOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>spike</title></head>
<body style="font:18px sans-serif;padding:24px;background:#cfc">
<h1 id="ok">loadFile OK</h1>
</body></html>
EOF
  cat >"$app_dir_res/main.js" <<'EOF'
'use strict';
const {app, BrowserWindow} = require('electron');
const path = require('path');
const fs = require('fs');
const marker = '/tmp/iblokz-spike-loaded.txt';

app.whenReady().then(() => {
  try { fs.unlinkSync(marker); } catch (e) {}
  const win = new BrowserWindow({
    width: 640,
    height: 480,
    show: true,
    webPreferences: {nodeIntegration: false, contextIsolation: true}
  });
  const index = path.join(__dirname, 'index.html');
  win.webContents.on('did-finish-load', () => {
    fs.writeFileSync(marker, 'did-finish-load ' + process.versions.electron + '\n');
    console.log('spike loadFile OK', process.versions.electron);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    fs.writeFileSync(marker, 'did-fail-load ' + code + ' ' + desc + ' ' + url + '\n');
    console.error('spike loadFile FAIL', code, desc, url);
  });
  console.log('loading', index, 'exists', fs.existsSync(index));
  win.loadFile(index);
});
EOF
  rm -f "$resources/default_app.asar"
}

try_version() {
  local ver="$1"
  local zip_name="electron-v${ver}-darwin-x64.zip"
  local url="https://github.com/electron/electron/releases/download/v${ver}/${zip_name}"
  local work="$SPIKE_ROOT/v${ver}"
  local zip="$SPIKE_ROOT/${zip_name}"
  local app="$work/Electron.app"
  local remote_log="/tmp/iblokz-electron-spike-v${ver}.log"

  echo ""
  echo "======== Electron v${ver} (loadFile) ========"
  mkdir -p "$work"
  if [ ! -f "$zip" ]; then
    echo "Downloading $url ..."
    curl -fL --retry 3 -o "$zip" "$url" || {
      echo "FAIL v${ver}: download"
      return 1
    }
  else
    echo "Using cached $zip"
  fi
  rm -rf "${work:?}/"*
  unzip -q "$zip" -d "$work"
  if [ ! -d "$app" ]; then
    echo "FAIL v${ver}: Electron.app missing" >&2
    return 1
  fi
  make_minimal_app "$app"
  if [ -f "$app/Contents/Info.plist" ]; then
    /usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion 10.10.0" "$app/Contents/Info.plist" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add :LSMinimumSystemVersion string 10.10.0" "$app/Contents/Info.plist" 2>/dev/null \
      || true
  fi

  echo "Rsync → ${HOST}:~/${REMOTE_REL}/Electron.app"
  ssh "$HOST" "mkdir -p ${REMOTE_REL}; pkill -f '${REMOTE_REL}/Electron' 2>/dev/null || true; rm -f ${MARKER_REMOTE}"
  rsync -azP --delete "${app}/" "${HOST}:${REMOTE_REL}/Electron.app/"
  ssh "$HOST" "xattr -cr ${REMOTE_REL}/Electron.app 2>/dev/null || true"

  echo "Launching (wait up to 15s for did-finish-load)…"
  ssh "$HOST" "rm -f ${remote_log} ${MARKER_REMOTE}; nohup ${REMOTE_REL}/Electron.app/Contents/MacOS/Electron >${remote_log} 2>&1 & echo \$! > /tmp/iblokz-spike.pid"

  local i marker=""
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 1
    marker=$(ssh "$HOST" "cat ${MARKER_REMOTE} 2>/dev/null || true")
    if [ -n "$marker" ]; then
      break
    fi
  done

  echo "marker: ${marker:-'(none)'}"
  echo "--- log ---"
  ssh "$HOST" "tail -n 30 ${remote_log} 2>/dev/null || true"
  ssh "$HOST" "pkill -f '${REMOTE_REL}/Electron' 2>/dev/null || true" || true

  if echo "$marker" | grep -q 'did-finish-load'; then
    echo "OK v${ver}: loadFile completed"
    echo "$ver" >"$SPIKE_ROOT/PINNED_VERSION"
    return 0
  fi
  echo "FAIL v${ver}: no did-finish-load"
  return 1
}

for ver in "${VERSIONS[@]}"; do
  if try_version "$ver"; then
    echo ""
    echo "Pinned Electron ${ver} → $SPIKE_ROOT/PINNED_VERSION"
    echo "Update config/macos-legacy.env ELECTRON_LEGACY_VERSION=${ver}"
    exit 0
  fi
done

echo "No version completed loadFile on $HOST" >&2
exit 1
