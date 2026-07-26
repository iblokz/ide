#!/usr/bin/env bash
# Alias — icon generation lives in assets.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/assets.sh" "$@"
