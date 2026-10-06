#!/usr/bin/env bash
# scripts/lib/exceptions.sh — approved exceptions from .compliance-exceptions.yml
# (ci-compliance-spec.md ข้อ 11.1) for the checks that honour them: UI-01 and ARC-02.
#
# Source it from a check that has already cd'ed into the target repo:
#
#   active_exceptions UI-01
#     one line per exception of that check that still counts:
#     scope|dependency|issue|expires   (an empty field is "-")
#   exception_covers_path <scope> <path>
#     a scope is one file, or a folder when it ends with "/"
#
# Only an exception with an issue, a scope other than "*" and an expiry that
# has not passed counts — EXC-01 reports the others. The file itself can be
# approved only by DevOps (CODEOWNERS), so a subsystem cannot excuse itself.
# Plain line scanning like check-exceptions.sh: no yq, runs on bash 3.2.

EXCEPTIONS_FILE=".compliance-exceptions.yml"

_exc_value() {
  local v="${1%$'\r'}" # files saved on Windows end lines with CR
  v="${v%"${v##*[![:space:]]}"}" # trailing spaces
  if [[ "$v" == \"*\" ]]; then v="${v#\"}"; v="${v%\"}"; fi
  if [[ "$v" == \'*\' ]]; then v="${v#\'}"; v="${v%\'}"; fi
  printf '%s' "$v"
}

active_exceptions() {
  local want="$1" today check="" scope="" dep="" issue="" expires="" line
  [[ -f "$EXCEPTIONS_FILE" ]] || return 0
  today=$(date +%Y-%m-%d)

  _exc_emit() {
    if [[ "$check" == "$want" && -n "$issue" && -n "$expires" && ! "$expires" < "$today" \
          && -n "$scope" && "$scope" != "*" ]]; then
      printf '%s|%s|%s|%s\n' "${scope#./}" "${dep:--}" "$issue" "$expires"
    fi
  }

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*check:[[:space:]]*(.*)$ ]]; then
      _exc_emit
      check=$(_exc_value "${BASH_REMATCH[1]}"); scope=""; dep=""; issue=""; expires=""
    elif [[ "$line" =~ ^[[:space:]]*scope:[[:space:]]*(.*)$ ]]; then
      scope=$(_exc_value "${BASH_REMATCH[1]}")
    elif [[ "$line" =~ ^[[:space:]]*dependency:[[:space:]]*(.*)$ ]]; then
      dep=$(_exc_value "${BASH_REMATCH[1]}")
    elif [[ "$line" =~ ^[[:space:]]*issue:[[:space:]]*(.*)$ ]]; then
      issue=$(_exc_value "${BASH_REMATCH[1]}")
    elif [[ "$line" =~ ^[[:space:]]*expires:[[:space:]]*(.*)$ ]]; then
      expires=$(_exc_value "${BASH_REMATCH[1]}")
    fi
  done < "$EXCEPTIONS_FILE"
  _exc_emit
  return 0
}

exception_covers_path() {
  local scope="${1#./}" path="${2#./}"
  [[ "$path" == "$scope" ]] && return 0
  [[ "$scope" == */ && "$path" == "$scope"* ]] && return 0
  return 1
}

# Prints one warning per exception in use, as ci-compliance-spec 11.1 asks.
warn_exceptions() {
  local check="$1" list="$2" scope dep issue expires
  [[ -n "$list" ]] || return 0
  while IFS='|' read -r scope dep issue expires; do
    [[ -z "$scope" ]] && continue
    if [[ "$dep" == "-" ]]; then
      echo "⚠️  [$check] ยกเว้นตาม .compliance-exceptions.yml: $scope (issue $issue · หมดอายุ $expires)"
    else
      echo "⚠️  [$check] ยกเว้นตาม .compliance-exceptions.yml: $dep ใน $scope (issue $issue · หมดอายุ $expires)"
    fi
  done <<< "$list"
}
