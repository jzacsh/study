#!/usr/bin/env bash
set -euo pipefail

(( $# == 1 )) || (
  printf 'Error: no arguments\nusage: %s OUT_FILE
  Triggers an area screenshot to overwrite OUT_FILE\n' \
    "$(basename "$0")" >&2
  exit 1
)
declare -r outF="$1"

sshotOver() ( gnome-screenshot --area --file "$1"; )
pngToWebp() ( cwebp "$1"  -o "$2"; )

if [[ "$outF" =~ \.webp$ ]];then
  png="$(mktemp --tmpdir  tmp_sshot_pre-webp_XXXXXX.png)"
  cleanup() ( rm -v "$png"; ); trap cleanup EXIT
  (
    set -x
    sshotOver "$png"
    pngToWebp "$png" "$outF"
  )
else
  ( set -x; sshotOver "$outF"; )
fi
