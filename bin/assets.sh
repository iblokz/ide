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
# Web/Electron + Android mipmap densities (mdpi…xxxhdpi)
SIZES=(16 32 48 64 72 96 128 144 180 192 256 512 1024)
ANDROID_MIPMAPS=(
  "mipmap-mdpi:48"
  "mipmap-hdpi:72"
  "mipmap-xhdpi:96"
  "mipmap-xxhdpi:144"
  "mipmap-xxxhdpi:192"
)
# Adaptive icon background (matches dark chrome)
ANDROID_ICON_BG="${ANDROID_ICON_BG:-#12161c}"
SYNC_DIST=0
SYNC_ONLY=0
SYNC_ANDROID=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --sync-dist) SYNC_DIST=1 ;;
    --sync-only) SYNC_ONLY=1; SYNC_DIST=1 ;;
    --sync-android) SYNC_ANDROID=1 ;;
    --force|-f) FORCE=1 ;;
    -h|--help)
      echo "Usage: $0 [--force] [--sync-dist|--sync-only] [--sync-android]"
      echo "  Build assets into build/assets/ (+ stage src/assets for Parcel)."
      echo "  --force         rebuild even if outputs look fresh"
      echo "  --sync-dist     rebuild (if needed), then copy → dist/assets/"
      echo "  --sync-only     only copy build/assets → dist/assets/"
      echo "  --sync-android  install launcher mipmaps into android/ (if present)"
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

# Install launcher icons into Capacitor android/ mipmaps (regenerated platform tree).
sync_android_icons() {
  local res="android/app/src/main/res"
  if [ ! -d "$res" ]; then
    echo "android/ res missing — skip launcher icons (run cap add android first)"
    return 0
  fi
  if [ ! -f "$OUT_DIR/icons/icon-192.png" ]; then
    echo "Built icons missing — run $0 first" >&2
    return 1
  fi

  local entry density size src out_dir inner
  for entry in "${ANDROID_MIPMAPS[@]}"; do
    density="${entry%%:*}"
    size="${entry##*:}"
    src="$OUT_DIR/icons/icon-${size}.png"
    out_dir="$res/$density"
    mkdir -p "$out_dir"
    cp -f "$src" "$out_dir/ic_launcher.png"
    cp -f "$src" "$out_dir/ic_launcher_round.png"
    # Adaptive foreground: ~72% inset so the mask doesn't clip the logo
    inner=$((size * 72 / 100))
    convert "$src" \
      -resize "${inner}x${inner}" \
      -background none \
      -gravity center \
      -extent "${size}x${size}" \
      -strip \
      "$out_dir/ic_launcher_foreground.png"
    cp -f "$out_dir/ic_launcher_foreground.png" \
      "$out_dir/ic_launcher_round_foreground.png"
    echo "  $density (${size}px)"
  done

  mkdir -p "$res/values"
  cat > "$res/values/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ANDROID_ICON_BG}</color>
</resources>
EOF
  echo "Android launcher icons → $res/mipmap-* (bg ${ANDROID_ICON_BG})"
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
  if [ "$SYNC_ANDROID" -eq 1 ]; then
    sync_android_icons
  fi
  exit 0
fi

if [ "$FORCE" -eq 0 ] && assets_fresh; then
  echo "Assets up to date — skip rebuild (use --force to regenerate)"
  if [ "$SYNC_DIST" -eq 1 ]; then
    sync_to_parcel_dist
  fi
  if [ "$SYNC_ANDROID" -eq 1 ]; then
    sync_android_icons
  fi
  exit 0
fi

if ! command -v convert &>/dev/null; then
  echo "ImageMagick 'convert' is required." >&2
  echo "  macOS (MacPorts):  sudo port install ImageMagick" >&2
  echo "  macOS (Homebrew):  brew install imagemagick" >&2
  echo "  Linux (Debian/Ubuntu):  sudo apt install imagemagick" >&2
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

  # Proper .icns for macOS (avoids electron-builder PNG→icns Spotlight corruption)
  if [ "$(uname -s)" = "Darwin" ] && command -v iconutil &>/dev/null; then
    ICONSET="$TMP_DIR/icons/app.iconset"
    mkdir -p "$ICONSET"
    cp "$TMP_DIR/icons/icon-16.png"   "$ICONSET/icon_16x16.png"
    cp "$TMP_DIR/icons/icon-32.png"   "$ICONSET/icon_16x16@2x.png"
    cp "$TMP_DIR/icons/icon-32.png"   "$ICONSET/icon_32x32.png"
    cp "$TMP_DIR/icons/icon-64.png"   "$ICONSET/icon_32x32@2x.png"
    cp "$TMP_DIR/icons/icon-128.png"  "$ICONSET/icon_128x128.png"
    cp "$TMP_DIR/icons/icon-256.png"  "$ICONSET/icon_128x128@2x.png"
    cp "$TMP_DIR/icons/icon-256.png"  "$ICONSET/icon_256x256.png"
    cp "$TMP_DIR/icons/icon-512.png"  "$ICONSET/icon_256x256@2x.png"
    cp "$TMP_DIR/icons/icon-512.png"  "$ICONSET/icon_512x512.png"
    cp "$TMP_DIR/icons/icon-1024.png" "$ICONSET/icon_512x512@2x.png"
    if iconutil -c icns "$ICONSET" -o "$TMP_DIR/icons/icon.icns"; then
      echo "  icons/icon.icns"
    else
      echo "Warning: iconutil failed — mac packaging may use electron-builder PNG conversion" >&2
    fi
    rm -rf "$ICONSET"
  fi

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

if [ "$SYNC_ANDROID" -eq 1 ] || [ -d android/app/src/main/res ]; then
  sync_android_icons
fi

# Asset identity/content changed — drop Parcel LMDB cache to avoid "key not found"
if [ -d .parcel-cache ]; then
  rm -rf .parcel-cache
  echo "Cleared .parcel-cache (assets rebuilt)"
fi

if [ "$SYNC_DIST" -eq 1 ]; then
  sync_to_parcel_dist
fi
