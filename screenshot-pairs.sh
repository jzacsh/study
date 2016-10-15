#!/usr/bin/env bash
set -euo pipefail

this="$(basename "$(readlink -f "${BASH_SOURCE[0]}")")"; declare -r this
{ (( $# <= 1 )) && [[ ${1:-} != -h ]] && [[ ${1:-} != --help ]]; } || {
  printf 'USAGE: `%s [INTEGER]`
  Continually interrupts with area (mouse-selection) screenshots, numbering the
  even ones, and labeling the odds as "back", eg:

   Prompt |  Screenshot Name
  ----------------------------------
    1     | flashcards_01_front.png
    2     | flashcards_01_back.png
    3     | flashcards_03_front.png
    4     | flashcards_04_back.png

  Screenshots start at 1, unless INTEGER is provided (eg: 03) which causes the
  program to prompt for creation of flashcards_INTEGER_front.png (eg:
  flashcards_03_front.png)

  Some other likely-buggy stuff is at play (eg: trying to pause every few
  screenshots to allow you to scroll - say in a large PDF).
' "$this" >&2
  exit 1
}

i=0; n=${1:-$i}; offset=${1:-''}
contrib() (
  local con=$n
  if [[ -n "${offset/ */}" ]];then con=$(( n - offset )); fi
  printf '%d' $con
)
report() (
  local action=Created
  if [[ -n "${offset/ */}" ]];then action=Added; fi
  printf '\nDONE. %s %d cards! Check:\n%s\n\n' \
    "$action" \
    $(contrib) \
    "$(readlink -f "$(pwd)")" \
    >&2
)
trap report EXIT
while true;do
  if (( i % 2 ));then side=back; else side=front; fi

  printf -v cardOut 'flashcard_%02d_%s.png' $n "$side"
  printf '\nWAITING on: %s of card %02d ...\t' "${side^^}" $n >&2
  (
   set -x
   gnome-screenshot \
     --area \
     --file="$cardOut"
  )

  if { (( $(contrib) >= 3 )) && (( $(contrib) % 3 == 0 )); };then
    read -p 'PAUSING FOR CONTINUE CONFIRMATION. Press ANY key...' _
  fi

  ! (( i % 2 )) || n=$(( n + 1 )) # we just finished a back
  i=$(( i + 1 ))
done
