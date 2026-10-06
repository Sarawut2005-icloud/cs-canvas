#!/usr/bin/env bash
# scripts/check-authorized-deps.sh — ARC-02, ARC-03
#
# `dependencies` (runtime) and `devDependencies` (build tooling) are checked
# against different lists on purpose. tech-stack.md ข้อ 1 is an architectural
# rule — which framework, which UI kit, which DB client ships to production —
# and that is what `allowed_frontend`/`allowed_backend` encode. A type stub or
# an eslint parser is not an architectural choice, and holding devDependencies
# to the runtime list made QA-01..04 impossible to satisfy: a Next app cannot
# typecheck without @types/react, TypeScript cannot be linted without a TS
# parser, and a Nest app cannot build without @nestjs/cli.
#
# `forbidden_everywhere` still applies to both — a banned UI kit hidden in
# devDependencies is still banned.
#
# Usage: check-authorized-deps.sh [target_dir]
set -euo pipefail

# jq.exe on Windows (Git Bash) ends every output line with CR, so "true\r"
# never equals "true" and names carry a trailing CR. Strip it here; on Linux,
# where CI runs, nothing changes. Defined only when jq exists, so the
# "no jq" checks below still work, and it keeps jq's own exit status.
if command -v jq >/dev/null 2>&1; then
  jq() { command jq "$@" | tr -d '\r'; return "${PIPESTATUS[0]}"; }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWED_DEPS="$SCRIPT_DIR/lib/allowed-deps.json"

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

# shellcheck source=lib/exceptions.sh
source "$SCRIPT_DIR/lib/exceptions.sh"
ARC02_EXCEPTIONS=$(active_exceptions ARC-02)

# profile=core-hub เปิดใช้ allowed_core_hub เพิ่มจาก allowed_backend
# csmju-core-hub เป็นผู้ออก token เอง จึงต้องมีไลบรารีเซ็น/ตรวจของตัวเอง
# (ดู docs/core-hub-rules.md) — ระบบย่อยห้ามใช้ profile นี้
PROFILE="${CSMJU_PROFILE:-subsystem}"

if ! command -v jq >/dev/null 2>&1; then
  echo "✅ [ARC-02/03] ข้ามการตรวจ (ไม่พบ jq ในเครื่อง)"
  exit 0
fi

VIOLATION=0

is_forbidden() {
  # profile=core-hub: dependency ที่อยู่ใน allowed_core_hub ชนะรายการห้ามทั่วไป
  # (เช่น passport-jwt ที่ระบบย่อยห้ามใช้ แต่ Core Hub ใช้ตรวจ token ของตัวเอง)
  if [[ "$PROFILE" == "core-hub" ]] \
    && [[ "$(jq --arg d "$1" '.allowed_core_hub | index($d) != null' "$ALLOWED_DEPS")" == "true" ]]; then
    return 1
  fi
  [[ "$(jq --arg d "$1" '.forbidden_everywhere | index($d) != null' "$ALLOWED_DEPS")" == "true" ]]
}
in_list() {
  if [[ "$(jq --arg d "$1" --arg k "$2" '.[$k] | index($d) != null' "$ALLOWED_DEPS")" == "true" ]]; then
    return 0
  fi
  if [[ "$PROFILE" == "core-hub" ]]; then
    [[ "$(jq --arg d "$1" '.allowed_core_hub | index($d) != null' "$ALLOWED_DEPS")" == "true" ]]
    return
  fi
  return 1
}
# pattern ต้องผูกกับ $p ก่อนใช้ — ใน `$d | test(.)` ตัว `.` คือ $d เอง
# ชื่อ package จึงถูกใช้เป็น regex ของตัวมันเองและตรงเสมอ (devDependency
# ทุกตัวเคยผ่านข้อนี้ รวมถึงไลบรารี runtime ที่ย้ายไปซ่อนใน devDependencies)
matches_dev_pattern() {
  [[ "$(jq -r --arg d "$1" '[.dev_tooling_patterns[] as $p | select($d | test($p))] | length > 0' "$ALLOWED_DEPS")" == "true" ]]
}

report_forbidden() {
  cat <<EOF
❌ [ARC-03] Dependency ต้องห้ามใน $2
   พบ: $1
   อ้างอิง: tech-stack.md ข้อ 1 / ci-compliance-spec.md §7.3
   วิธีแก้: ลบ dependency นี้ออก และใช้ทางเลือกที่อยู่ใน whitelist ของ stack แทน
EOF
}

# An approved ARC-02 exception (ci-compliance-spec 11.1) names both the
# package.json and the dependency. It never lifts ARC-03 (forbidden).
dependency_excepted() {
  local pkg="$1" dep="$2" scope edep rest
  [[ -n "$ARC02_EXCEPTIONS" ]] || return 1
  while IFS='|' read -r scope edep rest; do
    [[ "${scope#./}" == "${pkg#./}" && "$edep" == "$dep" ]] && return 0
  done <<< "$ARC02_EXCEPTIONS"
  return 1
}

check_section() {
  local pkg="$1" section="$2" allowed_key="$3" kind="$4"
  local deps
  deps=$(jq -r --arg s "$section" '(.[$s] // {}) | keys[]' "$pkg" 2>/dev/null || true)

  while IFS= read -r DEP; do
    [[ -z "$DEP" ]] && continue

    if is_forbidden "$DEP"; then
      report_forbidden "$DEP" "$pkg"
      VIOLATION=1
      continue
    fi

    if in_list "$DEP" "$allowed_key"; then
      continue
    fi
    # devDependencies ผ่านได้อีกทางถ้าเป็น build tooling หรือ type stub
    if [[ "$kind" == "dev" ]] \
      && { in_list "$DEP" "allowed_dev_tooling" || matches_dev_pattern "$DEP"; }; then
      continue
    fi

    if dependency_excepted "$pkg" "$DEP"; then
      continue
    fi

    cat <<EOF
❌ [ARC-02] Dependency ไม่อยู่ใน whitelist ของ stack ใน $pkg ($section)
   พบ: $DEP
   อ้างอิง: tech-stack.md ข้อ 1
   วิธีแก้: เปิด issue ขอ DevOps เพิ่มเข้า whitelist หรือใช้ dependency ที่อนุมัติแล้วแทน
            devDependencies ที่เป็นเครื่องมือ build/lint/test เพิ่มที่ allowed_dev_tooling
EOF
    VIOLATION=1
  done <<< "$deps"
}

check_side() {
  local side_dir="$1" allowed_key="$2"
  local pkg="$side_dir/package.json"
  [[ -f "$pkg" ]] || return 0
  check_section "$pkg" "dependencies"    "$allowed_key" "runtime"
  check_section "$pkg" "devDependencies" "$allowed_key" "dev"
}

check_side "frontend" "allowed_frontend"
check_side "backend"  "allowed_backend"
warn_exceptions ARC-02 "$ARC02_EXCEPTIONS"

if [[ "$VIOLATION" -eq 1 ]]; then
  exit 1
fi
echo "✅ [ARC-02/03] Dependency ทั้งหมดอยู่ใน whitelist"
