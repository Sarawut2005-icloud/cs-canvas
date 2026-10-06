#!/usr/bin/env bash
# scripts/lib/report.sh
# Shared helper to print a compliance failure in the standard format
# required by ci-compliance-spec.md §6.3. Source this file, then call
# report_fail with named args.
#
# Usage:
#   report_fail CODE "<description>" FILE "<path:line>" FOUND "<value>" \
#     EXPECT "<value>" REF "<doc.md ข้อ N>" FIX "<how to fix>"

report_fail() {
  local code="" desc="" file="" found="" expect="" ref="" fix=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      CODE) code="$2"; shift 2 ;;
      DESC) desc="$2"; shift 2 ;;
      FILE) file="$2"; shift 2 ;;
      FOUND) found="$2"; shift 2 ;;
      EXPECT) expect="$2"; shift 2 ;;
      REF) ref="$2"; shift 2 ;;
      FIX) fix="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  echo "❌ [$code] $desc"
  [[ -n "$file" ]]   && echo "   ไฟล์: $file"
  [[ -n "$found" ]]  && echo "   พบ: $found"
  [[ -n "$expect" ]] && echo "   ต้องเป็น: $expect"
  [[ -n "$ref" ]]    && echo "   อ้างอิง: $ref"
  [[ -n "$fix" ]]    && echo "   วิธีแก้: $fix"
}

report_warn() {
  local code="$1"; shift
  local desc="$1"; shift
  echo "⚠️  [$code] $desc"
}

report_pass() {
  local code="$1"; shift
  local desc="$1"; shift
  echo "✅ [$code] $desc"
}
