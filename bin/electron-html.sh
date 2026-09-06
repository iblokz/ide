#!/usr/bin/env bash
# Post-process dist/index.html for Electron packaging (classic scripts, Cap head).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"
cd "$(dirname "$SCRIPT_DIR")"
ensure_capacitor_index_html
ensure_electron_classic_scripts
ensure_electron_webkit_masks
