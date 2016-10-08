#!/usr/bin/env bash
set -euo pipefail

declare -r flashcardRegexp='flashcard*.webp'
this="$(basename "$(readlink -f "${BASH_SOURCE[0]}")")"; declare -r this
usage() (
  printf 'USAGE: `%s CARDS_DIR TITLE DESCRIPTION`

  Writes new metadata files to CARDS_DIR describing flashcard set.

  ARGUMENTS:
    - CARDS_DIR: directory where flashcards exist in front/back webp images, in
      with a naming pattern matching "%s", and are direct children of CARDS_DIR
    - TITLE: Short string describing the flashcard set.
    - DESCRIPTION: Arbitrarily long string decribing flashcard set, perhaps
      including dates intended for, class used in, sources used, etc.
' "$this" "$flashcardRegexp"
)

if (( $# == 1 )) && { [[ $1 = help ]] || [[ $1 = --help ]] || [[ $1 = -h ]]; }; then
  usage
  exit
fi

usageTip() (
  local msg="$1"; shift
  printf -- 'Error: '"$msg" $@ >&2
  printf 'See help (-h) for more.\n' >&2
  exit 1
)

(( $# == 3 )) || usageTip 'incorrect number of arguments (%d found)\n' $#

declare -r arg_cardDir="$1"
{ [[ -d "$arg_cardDir" ]] && [[ -w "$arg_cardDir" ]] && [[ -r "$arg_cardDir" ]]; } ||
  usageTip 'CARDS_DIR not a readable & writeable directory.\n' "$arg_cardDir"

declare -r arg_title="$2"; [[ -n "${arg_title/ */}" ]] ||
  usageTip 'missing TITLE argument (got "%s")\n' "$arg_title"

declare -r arg_description="$3"; [[ -n "${arg_description/ */}" ]] ||
  usageTip 'missing DESCRIPTION argument (got "%s")\n' "$arg_description"

find "$arg_cardDir" \
  -mindepth 1 -maxdepth 1 \
  -type f \
  -name "$flashcardRegexp" \
  -printf '%P\n' |
    sort > "$arg_cardDir"/index

echo "$arg_title" > "$arg_cardDir"/title

echo "$arg_description" | fold --width=80 > "$arg_cardDir"/description
