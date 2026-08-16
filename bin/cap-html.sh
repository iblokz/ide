#!/usr/bin/env bash
# Ensure dist/index.html keeps <head> so Capacitor can inject the native bridge.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=inc/common.sh
source "$SCRIPT_DIR/inc/common.sh"
cd "$(dirname "$SCRIPT_DIR")"
ensure_capacitor_index_html
