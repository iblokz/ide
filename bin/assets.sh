#!/usr/bin/env bash
# Build project assets → build/assets/ (gitignored), then stage web copies.
#
# Sources (committed):
#   assets/icon.png     — master app icon
#   assets/static/**    — copied through as-is
#
# Outputs:
#   build/assets/…      — full asset build
#   src/assets/         — stable copies for Parcel (overwrite in place)
#   dist/assets/        — with --sync-only after Parcel build
#
# Skips rebuild when outputs are newer than sources (use --force to rebuild).
# Clears .parcel-cache when a rebuild actually runs (avoids LMDB "key not found").
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

SOURCE_ICON="${ICON_SOURCE:-assets/icon.png}"
STATIC_DIR="assets/static"
OUT_DIR="build/assets"
WEB_DIR="src/assets"
SIZES=(16 32 48 64 128 180 256 512 1024)
SYNC_DIST=0
SYNC_ONLY=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --sync-dist) SYNC_DIST=1 ;;
    --sync-only) SYNC_ONLY=1; SYNC_DIST=1 ;;
    --force|-f) FORCE=1 ;;
    -h|--help)
      echo "Usage: $0 [--force] [--sync-dist|--sync-only]"
      echo "  Build assets into build/assets/ (+ stage src/assets for Parcel)."
      echo "  --force      rebuild even if outputs look fresh"
      echo "  --sync-dist  rebuild (if needed), then copy → dist/assets/"
      echo "  --sync-only  only copy build/assets → dist/assets/"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

sync_to_parcel_dist() {
  if [ ! -d dist ]; then
    echo "dist/ missing — run Parcel build first" >&2
    exit 1
  fi
  if [ ! -d "$OUT_DIR" ]; then
    echo "$OUT_DIR missing — run $0 first" >&2
    exit 1
  fi
  rm -rf dist/assets
  cp -a "$OUT_DIR" dist/assets
  echo "Synced → dist/assets/"
}

stage_web_assets() {
  mkdir -p "$WEB_DIR"
  cp -f "$OUT_DIR/favicon-16.png" "$WEB_DIR/favicon-16.png"
  cp -f "$OUT_DIR/favicon-32.png" "$WEB_DIR/favicon-32.png"
  cp -f "$OUT_DIR/favicon.ico" "$WEB_DIR/favicon.ico"
  cp -f "$OUT_DIR/icon.png" "$WEB_DIR/icon.png"
  cp -f "$OUT_DIR/apple-touch-icon.png" "$WEB_DIR/apple-touch-icon.png"
  echo "Staged → $WEB_DIR/"
}

assets_fresh() {
  [ -f "$OUT_DIR/icons/icon-256.png" ] || return 1
  [ -f "$OUT_DIR/icon.png" ] || return 1
  [ -f "$WEB_DIR/icon.png" ] || return 1
  if [ -f "$SOURCE_ICON" ] && [ "$SOURCE_ICON" -nt "$OUT_DIR/icons/icon-256.png" ]; then
    return 1
  fi
  if [ -d "$STATIC_DIR" ]; then
    while IFS= read -r -d '' f; do
      if [ "$f" -nt "$OUT_DIR/icons/icon-256.png" ]; then
        return 1
      fi
    done < <(find "$STATIC_DIR" -type f ! -name '.gitkeep' -print0 2>/dev/null)
  fi
  return 0
}

if [ "$SYNC_ONLY" -eq 1 ]; then
  sync_to_parcel_dist
  exit 0
fi

if [ "$FORCE" -eq 0 ] && assets_fresh; then
  echo "Assets up to date — skip rebuild (use --force to regenerate)"
  if [ "$SYNC_DIST" -eq 1 ]; then
    sync_to_parcel_dist
  fi
  exit 0
fi

if ! command -v convert &>/dev/null; then
  echo "ImageMagick 'convert' is required (e.g. sudo apt install imagemagick)" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/iblokz-assets.XXXXXX")"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkdir -p "$TMP_DIR/icons"

if [ -f "$SOURCE_ICON" ]; then
  SRC_W="$(convert "$SOURCE_ICON" -format "%w" info:)"
  SRC_H="$(convert "$SOURCE_ICON" -format "%h" info:)"
  SIDE="$SRC_W"
  if [ "$SRC_H" -gt "$SIDE" ]; then
    SIDE="$SRC_H"
  fi

  SQUARE="$TMP_DIR/icons/_square.png"
  convert "$SOURCE_ICON" \
    -background none \
    -gravity center \
    -extent "${SIDE}x${SIDE}" \
    -strip \
    "$SQUARE"

  echo "Icons from ${SOURCE_ICON} (${SRC_W}x${SRC_H} → ${SIDE}x${SIDE}):"
  for size in "${SIZES[@]}"; do
    convert "$SQUARE" \
      -resize "${size}x${size}" \
      -strip \
      "$TMP_DIR/icons/icon-${size}.png"
    echo "  icons/icon-${size}.png"
  done

  # Multi-size ICO for Electron (Windows) / favicon
  convert \
    "$TMP_DIR/icons/icon-16.png" \
    "$TMP_DIR/icons/icon-32.png" \
    "$TMP_DIR/icons/icon-48.png" \
    "$TMP_DIR/icons/icon-64.png" \
    "$TMP_DIR/icons/icon-128.png" \
    "$TMP_DIR/icons/icon-256.png" \
    "$TMP_DIR/icons/icon.ico"
  echo "  icons/icon.ico"
  cp "$TMP_DIR/icons/icon.ico" "$TMP_DIR/favicon.ico"

  cp "$TMP_DIR/icons/icon-16.png" "$TMP_DIR/favicon-16.png"
  cp "$TMP_DIR/icons/icon-32.png" "$TMP_DIR/favicon-32.png"
  cp "$TMP_DIR/icons/icon-64.png" "$TMP_DIR/icon.png"
  cp "$TMP_DIR/icons/icon-180.png" "$TMP_DIR/apple-touch-icon.png"
  rm -f "$SQUARE"
else
  echo "Warning: no $SOURCE_ICON — skipping icon generation" >&2
fi

if [ -d "$STATIC_DIR" ] && find "$STATIC_DIR" -type f ! -name '.gitkeep' | grep -q .; then
  echo "Copying $STATIC_DIR → build tree"
  cp -a "$STATIC_DIR"/. "$TMP_DIR"/
fi

mkdir -p "$(dirname "$OUT_DIR")"
rm -rf "$OUT_DIR"
mv "$TMP_DIR" "$OUT_DIR"
trap - EXIT
echo "Assets build done → $OUT_DIR"

stage_web_assets

# Asset identity/content changed — drop Parcel LMDB cache to avoid "key not found"
if [ -d .parcel-cache ]; then
  rm -rf .parcel-cache
  echo "Cleared .parcel-cache (assets rebuilt)"
fi

if [ "$SYNC_DIST" -eq 1 ]; then
  sync_to_parcel_dist
fi
