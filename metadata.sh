#!/usr/bin/env bash
set -euo pipefail

setsRoot="$(readlink -f "$1")"; declare -r setsRoot

set -x
find "$setsRoot" -mindepth 1 -maxdepth 1 -type d -printf '%P\n' | tee "$setsRoot".index
