#!/usr/bin/env bash
set -euo pipefail

declare -r flashcardRegexp='flashcard*.webp'
this="$(basename "$(readlink -f "${BASH_SOURCE[0]}")")"; declare -r this
usage() (
  printf 'USAGE: `%s CARDS_DIR [TITLE DESCRIPTION]`

  Writes new metadata files to CARDS_DIR describing flashcard set.

  ARGUMENTS:
    - CARDS_DIR: directory where flashcards exist in front/back webp images, in
      with a naming pattern matching "%s", and are direct children of CARDS_DIR
    - TITLE: Short string describing the flashcard set.
      If not provided, leaves existing file intact.
    - DESCRIPTION: Arbitrarily long string decribing flashcard set, perhaps
      including dates intended for, class used in, sources used, etc.
      If not provided, leaves existing file intact.
' "$this" "$flashcardRegexp"
)

if (( $# >= 1 )) && { [[ $1 = help ]] || [[ $1 = --help ]] || [[ $1 = -h ]]; }; then
  usage
  exit
fi

usageTip() (
  local msg="$1"; shift
  printf -- 'Error: '"$msg" $@ >&2
  printf 'See help (-h) for more.\n' >&2
  exit 1
)

(( $# )) || usageTip 'No arguments found\n'

declare -r arg_cardDir="$1"
{ [[ -d "$arg_cardDir" ]] && [[ -w "$arg_cardDir" ]] && [[ -r "$arg_cardDir" ]]; } ||
  usageTip 'CARDS_DIR not a readable & writeable directory.\n' "$arg_cardDir"

writeIndexFile() (
  find "$arg_cardDir" \
    -mindepth 1 -maxdepth 1 \
    -type f \
    -name "$flashcardRegexp" \
    -printf '%P\n' |
      sort > "$arg_cardDir"/index
)

isNonEmptyFile() ( [[ -f "$1" ]] && [[ -r "$1" ]] && [[ -n "$(< "$1")" ]]; )

if (( $# == 1 ));then
  printf 'NOTE: leaving description and title files intact\n' >&2
  isNonEmptyFile "$arg_cardDir"/description ||
    usageTip 'No existing description file to default to\n'
  isNonEmptyFile "$arg_cardDir"/title ||
    usageTip 'No existing title file to default to\n'
  writeIndexFile
  exit $?
elif (( $# != 3 ));then
  usageTip 'incorrect number of arguments (%d found)\n' $#
fi

declare -r arg_title="$2"; [[ -n "${arg_title/ */}" ]] ||
  usageTip 'missing TITLE argument (got "%s")\n' "$arg_title"

declare -r arg_description="$3"; [[ -n "${arg_description/ */}" ]] ||
  usageTip 'missing DESCRIPTION argument (got "%s")\n' "$arg_description"

writeIndexFile

echo "$arg_title" > "$arg_cardDir"/title

echo "$arg_description" | fold --width=80 > "$arg_cardDir"/description
